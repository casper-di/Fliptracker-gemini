import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(req.user.uid);
    return { user };
  }
}
