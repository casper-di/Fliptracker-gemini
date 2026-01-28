import { Controller, Get, Delete, Param, Query, UseGuards, Req } from '@nestjs/common';
import { EmailEventsService } from './email-events.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { EmailEventFilters } from '../../domain/repositories';

@Controller('email-events')
@UseGuards(AuthGuard)
export class EmailEventsController {
  constructor(private emailEventsService: EmailEventsService) {}

  /**
   * GET /api/email-events
   * Retrieve all email events for the authenticated user
   */
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() filters: EmailEventFilters,
  ) {
    const result = await this.emailEventsService.findByUserId(req.user.uid, {
      provider: filters.provider,
      status: filters.status,
      startDate: filters.startDate ? new Date(filters.startDate as any) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate as any) : undefined,
      limit: filters.limit ? parseInt(filters.limit as any) : 50,
      offset: filters.offset ? parseInt(filters.offset as any) : 0,
    });

    return result;
  }

  /**
   * GET /api/email-events/:id
   * Retrieve a specific email event
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const event = await this.emailEventsService.findById(id);
    if (!event || event.userId !== req.user.uid) {
      return { error: 'Email event not found' };
    }
    return { event };
  }

  /**
   * DELETE /api/email-events/:id
   * Delete an email event record
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const event = await this.emailEventsService.findById(id);
    if (!event || event.userId !== req.user.uid) {
      return { error: 'Email event not found' };
    }

    await this.emailEventsService.delete(id);
    return { success: true };
  }

  /**
   * GET /api/email-events/pending/list
   * Retrieve pending email events for processing
   */
  @Get('pending/list')
  async findPending(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const events = await this.emailEventsService.findPending(
      req.user.uid,
      limit ? parseInt(limit) : 100,
    );
    return { events };
  }
}
