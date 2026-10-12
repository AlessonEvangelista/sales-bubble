import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemFilter } from '../../http/problem.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

/** Identidade e autenticação (E2). Depende do `DatabaseModule` (global). */
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, { provide: APP_FILTER, useClass: ProblemFilter }],
  exports: [AuthService, PasswordHasher],
})
export class AuthModule {}
