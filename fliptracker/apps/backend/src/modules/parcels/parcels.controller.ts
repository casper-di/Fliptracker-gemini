import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { CreateParcelDto, UpdateParcelDto, ParcelFiltersDto } from './dto';

@Controller('parcels')
@UseGuards(AuthGuard)
export class ParcelsController {
  constructor(private parcelsService: ParcelsService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() filters: ParcelFiltersDto,
  ) {
    // TODO: Enable once Firestore credentials fixed
    // const result = await this.parcelsService.findByUserId(req.user.uid, {...filters});
    return { data: [], total: 0 };
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
}
