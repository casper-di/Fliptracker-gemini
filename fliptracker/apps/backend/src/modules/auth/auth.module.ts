import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirebaseService, AuthGuard],
  exports: [FirebaseService, AuthGuard],
})
export class AuthModule {}
