import { Module } from '@nestjs/common';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';
import { MemberLevelController } from './level.controller.js';
import { MemberLevelService } from './level.service.js';
import { MemberTagController } from './tag.controller.js';
import { MemberTagService } from './tag.service.js';
import { PrismaService } from '../prisma.service.js';
import { MemberCategoryController } from './category.controller.js';
import { MemberCategoryService } from './category.service.js';
import { JwtModule } from '@nestjs/jwt';
import { VehicleController } from './vehicle.controller.js';
import { VehicleService } from './vehicle.service.js';
import { FileModule } from '../file/file.module.js';
import { WashCardController } from './washcard.controller.js';
import { WashCardService } from './washcard.service.js';
import { AddressController } from './address.controller.js';
import { AddressService } from './address.service.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';
import { MemberSignInController } from './signin.controller.js';
import { MemberSignInService } from './signin.service.js';
import { MemberPointsController } from './points.controller.js';
import { MemberPointsService } from './points.service.js';

@Module({
	imports: [
		JwtModule.register({
			secret: process.env.JWT_SECRET || 'dev_secret',
		}),
		FileModule,
	],
	controllers: [MemberController, MemberLevelController, MemberCategoryController, MemberTagController, VehicleController, WashCardController, AddressController, CartController, FavoriteController, MemberSignInController, MemberPointsController],
	providers: [MemberService, MemberLevelService, MemberCategoryService, MemberTagService, VehicleService, PrismaService, WashCardService, AddressService, CartService, FavoriteService, MemberSignInService, MemberPointsService],
})
export class MemberModule {}


