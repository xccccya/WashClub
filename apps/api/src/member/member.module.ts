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
import { FileService } from '../file/file.service.js';
import { WashCardController } from './washcard.controller.js';
import { WashCardService } from './washcard.service.js';
import { AddressController } from './address.controller.js';
import { AddressService } from './address.service.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';
import { AssetService } from '../file/asset.service.js';

@Module({
	imports: [
		JwtModule.register({
			secret: process.env.JWT_SECRET || 'dev_secret',
		}),
	],
	controllers: [MemberController, MemberLevelController, MemberCategoryController, MemberTagController, VehicleController, WashCardController, AddressController, CartController, FavoriteController],
	providers: [MemberService, MemberLevelService, MemberCategoryService, MemberTagService, VehicleService, PrismaService, FileService, AssetService, WashCardService, AddressService, CartService, FavoriteService],
})
export class MemberModule {}


