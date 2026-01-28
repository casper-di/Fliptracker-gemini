import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FirestoreUserRepository } from '../../infrastructure/repositories/firestore-user.repository';
import { USER_REPOSITORY } from '../../domain/repositories';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: FirestoreUserRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
