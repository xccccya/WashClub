import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SystemSettingController } from './system.setting.controller.js';
import { SystemEmployeeController } from './employee.controller.js';
import { SystemMiniappEmployeeController } from './miniapp.controller.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { FileModule } from '../file/file.module.js';
import { resolveJwtSecretEnv } from '../env.js';

@Module({
    imports: [
        JwtModule.register({
            secret: resolveJwtSecretEnv(),
        }),
        FileModule,
    ],
    controllers: [SystemSettingController, SystemEmployeeController, SystemMiniappEmployeeController],
    providers: [AdminGuard],
})
export class SystemModule {}


