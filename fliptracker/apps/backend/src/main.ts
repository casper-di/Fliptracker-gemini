import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS FIRST, before any other middleware
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';
  const frontendUrlsEnv = process.env.FRONTEND_URLS || '';
  const frontendUrls = frontendUrlsEnv
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log(`Environment: ${nodeEnv}`);
  const corsOriginsLog = frontendUrls.length > 0 ? frontendUrls.join(', ') : frontendUrl;
  console.log(`CORS enabled for origin(s): ${corsOriginsLog}`);

  app.enableCors({
    origin: function(origin, callback) {
      if (nodeEnv === 'production') {
        // En production, accepter uniquement les frontend URL(s)
        const allowedOrigins = frontendUrls.length > 0 ? frontendUrls : [frontendUrl];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // En développement, accepter toutes les origines
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Content-Type', 'Set-Cookie'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  });
  
  // Use cookie-parser middleware after CORS
  app.use(cookieParser());
  
  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on port ${port}`);
}

bootstrap();
