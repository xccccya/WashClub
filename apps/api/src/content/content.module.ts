import { Module } from '@nestjs/common';
import { ScrollNoticeService } from './scroll-notice.service.js';
import { ScrollNoticeController } from './scroll-notice.controller.js';
import { CarDataController } from './car-data.controller.js';
import { WeatherController } from './weather.controller.js';
import { DistrictController } from './district.controller.js';
import { AdBannerService } from './ad-banner.service.js';
import { AdBannerController } from './ad-banner.controller.js';
import { FileModule } from '../file/file.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [FileModule, AuthModule],
    controllers: [ScrollNoticeController, CarDataController, WeatherController, AdBannerController, DistrictController],
    providers: [ScrollNoticeService, AdBannerService],
})
export class ContentModule {}


