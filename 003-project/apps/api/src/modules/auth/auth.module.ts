import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { PrismaService } from '../database/prisma.service.js';
import { PiiService } from '../database/pii.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, PrismaService, PiiService],
  exports: [AuthService, PasswordHasher],
})
export class AuthModule {}
