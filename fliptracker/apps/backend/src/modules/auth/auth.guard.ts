import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from './firebase.service';

export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
    emailVerified: boolean;
    provider: 'google' | 'microsoft' | 'email';
  };
}

export const SKIP_EMAIL_VERIFICATION = 'skipEmailVerification';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private firebaseService: FirebaseService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const sessionCookie = request.cookies?.session;

    // Accept either Bearer token or session cookie
    let token: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else if (sessionCookie) {
      token = sessionCookie;
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token or session');
    }

    const decodedToken = await this.firebaseService.verifyToken(token);

    if (!decodedToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const signInProvider = decodedToken.firebase?.sign_in_provider || 'password';
    let provider: 'google' | 'microsoft' | 'email' = 'email';
    
    if (signInProvider === 'google.com') {
      provider = 'google';
    } else if (signInProvider === 'microsoft.com') {
      provider = 'microsoft';
    }

    const skipVerification = this.reflector.get<boolean>(
      SKIP_EMAIL_VERIFICATION,
      context.getHandler(),
    );

    if (
      this.firebaseService.isProduction() &&
      !skipVerification &&
      provider === 'email' &&
      !decodedToken.email_verified
    ) {
      throw new ForbiddenException('Email not verified. Please verify your email to continue.');
    }

    request.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      provider,
    };

    return true;
  }
}
