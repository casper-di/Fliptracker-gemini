import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS FIRST, before any other middleware
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';
  console.log(`CORS enabled for origin: ${frontendUrl}`);

  app.enableCors({
    origin: function(origin, callback) {
      // For development, allow all origins
      callback(null, true);
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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on port ${port}`);
}

bootstrap();
