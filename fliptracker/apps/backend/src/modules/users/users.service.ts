import { Injectable, Inject } from '@nestjs/common';
import { User } from '../../domain/entities';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private userRepository: IUserRepository,
  ) {}

  async findOrCreate(
    uid: string,
    email: string,
    provider: 'google' | 'microsoft' | 'email',
    emailVerified?: boolean,
  ): Promise<User> {
    let user = await this.userRepository.findById(uid);
    
    if (!user) {
      user = await this.userRepository.create({
        id: uid,
        email,
        provider,
        emailVerified,
      });
    } else if (emailVerified !== undefined && user.emailVerified !== emailVerified) {
      user = await this.userRepository.update(uid, { emailVerified });
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.userRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.userRepository.delete(id);
  }
}
