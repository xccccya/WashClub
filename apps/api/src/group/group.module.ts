import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module.js';
import { FileModule } from '../file/file.module.js';
import { GroupController } from './group.controller.js';
import { GroupMiniappController } from './miniapp.controller.js';
import { GroupMemberController } from './member.controller.js';
import { GroupVehicleController } from './vehicle.controller.js';
import { GroupBalanceController } from './balance.controller.js';
import { GroupCardController } from './card.controller.js';
import { GroupService } from './group.service.js';
import { GroupMemberService } from './member.service.js';
import { GroupVehicleService } from './vehicle.service.js';
import { GroupBalanceService } from './balance.service.js';
import { GroupCardService } from './card.service.js';
import { MemberModule } from '../member/member.module.js';
import { resolveJwtSecretEnv } from '../env.js';

@Module({
  imports: [
    AuthModule,
    FileModule,
    MemberModule,
    JwtModule.register({ secret: resolveJwtSecretEnv() })
  ],
  controllers: [
    GroupController,
    GroupMemberController,
    GroupVehicleController,
    GroupBalanceController,
    GroupCardController,
    GroupMiniappController
  ],
  providers: [
    GroupService,
    GroupMemberService,
    GroupVehicleService,
    GroupBalanceService,
    GroupCardService
  ],
  exports: [GroupCardService]
})
export class GroupModule {}
