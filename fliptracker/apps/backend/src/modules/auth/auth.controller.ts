import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { FirebaseService } from './firebase.service';
import { UsersService } from '../users/users.service';
import { ConnectedEmailsService } from '../connected-emails/connected-emails.service';
import { ParcelsService } from '../parcels/parcels.service';

@Controller('api/auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    private readonly connectedEmailsService: ConnectedEmailsService,
    private readonly parcelsService: ParcelsService,
  ) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    const { uid, email, emailVerified, provider } = req.user;

    const user = await this.usersService.findOrCreate(
      uid,
      email,
      provider,
      emailVerified,
    );

    return {
      id: user.id,
      email: user.email,
      provider: user.provider,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Req() req: AuthenticatedRequest) {
    const { uid } = req.user;

    const connectedEmails = await this.connectedEmailsService.findByUserId(uid);
    for (const email of connectedEmails) {
      await this.connectedEmailsService.delete(email.id);
    }

    const parcels = await this.parcelsService.findByUserId(uid, {});
    for (const parcel of parcels.data) {
      await this.parcelsService.delete(parcel.id, uid);
    }

    await this.usersService.delete(uid);

    await this.firebaseService.deleteUser(uid);
  }
}
