import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ScrollNoticeService } from './scroll-notice.service.js';
import { ScrollNoticeController } from './scroll-notice.controller.js';
import { CarDataController } from './car-data.controller.js';
import { WeatherController } from './weather.controller.js';
import { DistrictController } from './district.controller.js';
import { AdBannerService } from './ad-banner.service.js';
import { AdBannerController } from './ad-banner.controller.js';

@Module({
    imports: [],
    controllers: [ScrollNoticeController, CarDataController, WeatherController, AdBannerController, DistrictController],
    providers: [PrismaService, ScrollNoticeService, AdBannerService],
})
export class ContentModule {}


