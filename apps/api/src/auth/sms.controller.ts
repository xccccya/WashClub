import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';

@ApiTags('system')
@Controller('system')
@UseGuards(AdminGuard)
export class SmsAdminController {
    constructor(private prisma: PrismaService) {}

    // 短信记录列表（仅查询）
    @Get('sms-codes')
    @ApiOperation({ summary: '短信验证码记录列表（仅查询）' })
    @RequirePerm('system-sms')
    async listSmsCodes(
        @Query('phone') phone?: string,
        @Query('purpose') purpose?: 'login' | 'resetPwd',
        @Query('used') used?: '0' | '1',
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const p = Math.max(1, Number(page || 1) | 0);
        const ps = Math.min(100, Math.max(1, Number(pageSize || 20) | 0));
        const where: any = {};
        if (phone && /^\d{3,}$/.test(phone)) where.phone = phone;
        if (purpose === 'login' || purpose === 'resetPwd') where.purpose = purpose;
        if (used === '0') where.usedAt = null;
        if (used === '1') where.usedAt = { not: null };
        const [total, items] = await this.prisma.$transaction([
            this.prisma.smsCode.count({ where }),
            this.prisma.smsCode.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * ps, take: ps }),
        ]);
        return { total, page: p, pageSize: ps, items };
    }
}


