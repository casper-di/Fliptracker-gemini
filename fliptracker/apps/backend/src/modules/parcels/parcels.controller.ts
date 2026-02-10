import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { CreateParcelDto, UpdateParcelDto, ParcelFiltersDto } from './dto';
import { IParcelReportRepository, PARCEL_REPORT_REPOSITORY } from '../../domain/repositories';

@Controller('parcels')
@UseGuards(AuthGuard)
export class ParcelsController {
  private readonly logger = new Logger(ParcelsController.name);

  constructor(
    private parcelsService: ParcelsService,
    @Inject(PARCEL_REPORT_REPOSITORY) private reportRepo: IParcelReportRepository,
  ) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() filters: ParcelFiltersDto,
  ) {
    // Convert query params to correct types
    const parsedFilters: any = {
      ...filters,
      limit: filters.limit ? parseInt(filters.limit, 10) : undefined,
      offset: filters.offset ? parseInt(filters.offset, 10) : undefined,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };
    
    const result = await this.parcelsService.findByUserId(req.user.uid, parsedFilters);
    
    // Map Parcel.type to Shipment.direction for frontend compatibility
    const mappedData = (result.data || []).map(parcel => ({
      ...parcel,
      direction: parcel.type === 'purchase' ? 'INBOUND' : 'OUTBOUND',
      // Use product name if available, otherwise fall back to title or generic labels
      sender: parcel.type === 'purchase' 
        ? (parcel.productName || parcel.senderName || parcel.title || 'Marketplace')
        : 'You',
      recipient: parcel.type === 'purchase' 
        ? (parcel.recipientName || 'You')
        : (parcel.recipientName || 'Customer'),
      history: [],
      lastUpdated: parcel.updatedAt || parcel.createdAt,
    }));
    
    return { data: mappedData, total: result.total, limit: result.limit, offset: result.offset };
  }

  // Static routes MUST come before parameterized routes
  @Get('reports/unresolved')
  async getUnresolvedReports(@Req() req: AuthenticatedRequest) {
    const reports = await this.reportRepo.findAllUnresolved();
    return { reports, total: reports.length };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const parcel = await this.parcelsService.findById(id);
    if (!parcel || parcel.userId !== req.user.uid) {
      return { error: 'Parcel not found' };
    }
    return { parcel };
  }

  @Post()
  async create(
    @Body() createDto: CreateParcelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const parcel = await this.parcelsService.create({
      ...createDto,
      provider: (createDto.provider || 'gmail') as 'gmail' | 'outlook',
      status: createDto.status || 'pending',
      sourceEmailId: createDto.sourceEmailId || '',
      userId: req.user.uid,
    });
    return { parcel };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateParcelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const existing = await this.parcelsService.findById(id);
    if (!existing || existing.userId !== req.user.uid) {
      return { error: 'Parcel not found' };
    }

    const parcel = await this.parcelsService.update(id, updateDto);
    return { parcel };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const existing = await this.parcelsService.findById(id);
    if (!existing || existing.userId !== req.user.uid) {
      return { error: 'Parcel not found' };
    }

    await this.parcelsService.delete(id);
    return { success: true };
  }

  @Post(':id/report')
  async reportProblem(
    @Param('id') id: string,
    @Body() body: { trackingNumber: string; carrier: string; status: string; reason: string },
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`Report request for parcel ${id} by user ${req.user.uid}`);

    // Verify parcel belongs to user
    const existing = await this.parcelsService.findById(id);
    if (!existing || existing.userId !== req.user.uid) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Mark the parcel itself as reported so we can query it later
      await this.parcelsService.update(id, {
        reported: true,
        reportedAt: new Date(),
        reportReason: body.reason || 'parsing_issue',
      } as any);

      // Also store a detailed report record
      const report = await this.reportRepo.create({
        userId: req.user.uid,
        parcelId: id,
        trackingNumber: body.trackingNumber,
        carrier: body.carrier,
        status: body.status,
        reason: body.reason || 'parsing_issue',
        resolved: false,
      });

      this.logger.log(`Report created: ${report.id} for parcel ${id}`);
      return { success: true, report };
    } catch (error) {
      this.logger.error(`Failed to create report for parcel ${id}:`, error);
      throw new HttpException('Failed to create report', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
