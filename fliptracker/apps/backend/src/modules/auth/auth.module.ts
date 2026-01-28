import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { FirebaseService } from './firebase.service';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { ConnectedEmailsModule } from '../connected-emails/connected-emails.module';
import { ParcelsModule } from '../parcels/parcels.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,  // Increased from 10
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,  // Increased from 100
      },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => ConnectedEmailsModule),
    forwardRef(() => ParcelsModule),
  ],
  controllers: [AuthController],
  providers: [
    FirebaseService,
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [FirebaseService, AuthGuard],
})
export class AuthModule {}
