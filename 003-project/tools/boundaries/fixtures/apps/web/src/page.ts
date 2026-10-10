import { DATABASE_PACKAGE } from '@bolha/database';
import { AppModule } from '@bolha/api';
import { startTelemetry } from '@bolha/observability/node';
import { PATH } from '../../../packages/contracts/src/index';

export const page = [DATABASE_PACKAGE, AppModule, PATH, startTelemetry];
