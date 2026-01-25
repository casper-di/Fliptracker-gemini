import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await this.firebaseService.verifyToken(token);

    if (!decodedToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    return true;
  }
}
