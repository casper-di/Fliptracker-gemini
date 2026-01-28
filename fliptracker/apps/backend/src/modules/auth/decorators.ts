import { SetMetadata } from '@nestjs/common';
import { SKIP_EMAIL_VERIFICATION } from './auth.guard';

export const SkipEmailVerification = () => SetMetadata(SKIP_EMAIL_VERIFICATION, true);
