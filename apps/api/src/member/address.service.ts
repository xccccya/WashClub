import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AddressService {
    constructor(private prisma: PrismaService, private jwt: JwtService) {}

    private async getMemberIdFromToken(token?: string): Promise<number> {
        if (!token) throw new UnauthorizedException('缺少Token');
        try {
            const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
            const id = Number(decoded?.sub);
            if (!id || decoded?.type !== 'member') throw new UnauthorizedException('Token无效');
            return id;
        } catch {
            throw new UnauthorizedException('Token无效');
        }
    }

    async adminList(page = 1, pageSize = 20, keyword?: string) {
        const where: any = keyword
            ? {
                  OR: [
                      { province: { contains: keyword } },
                      { city: { contains: keyword } },
                      { district: { contains: keyword } },
                      { street: { contains: keyword } },
                      { detail: { contains: keyword } },
                      { phone: { contains: keyword } },
                      { member: { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] } },
                  ],
              }
            : undefined;
        const [items, total] = await Promise.all([
            this.prisma.memberAddress.findMany({
                skip: (page - 1) * pageSize,
                take: pageSize,
                where,
                orderBy: { id: 'desc' },
                include: { member: { select: { id: true, name: true, phone: true } } },
            }),
            this.prisma.memberAddress.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }

    listByMember(memberId: number) {
        return this.prisma.memberAddress.findMany({ where: { memberId }, orderBy: { id: 'desc' } });
    }

    async meList(token?: string) {
        const memberId = await this.getMemberIdFromToken(token);
        return this.listByMember(memberId);
    }

    async meCreate(token: string | undefined, input: { province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }) {
        const memberId = await this.getMemberIdFromToken(token);
        this.assertInput(input);
        const data = this.normalize(input);
        return this.prisma.memberAddress.create({ data: { ...data, memberId } });
    }

    async meUpdate(token: string | undefined, id: number, input: Partial<{ province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }>) {
        const memberId = await this.getMemberIdFromToken(token);
        const existing = await this.prisma.memberAddress.findUnique({ where: { id } });
        if (!existing || existing.memberId !== memberId) throw new UnauthorizedException('无权操作该地址');
        if (input) this.assertPartialInput(input);
        const data = this.normalizePartial(input);
        return this.prisma.memberAddress.update({ where: { id }, data });
    }

    async meDelete(token: string | undefined, id: number) {
        const memberId = await this.getMemberIdFromToken(token);
        const existing = await this.prisma.memberAddress.findUnique({ where: { id } });
        if (!existing || existing.memberId !== memberId) throw new UnauthorizedException('无权操作该地址');
        await this.prisma.memberAddress.delete({ where: { id } });
        return { ok: true };
    }

    private assertInput(input: { province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }) {
        const { province, city, district, street, detail, phone, label } = input || ({} as any);
        if (!province || !city || !district || !street) throw new BadRequestException('省市区街道为必填');
        if (!detail || !detail.trim()) throw new BadRequestException('详细地址为必填');
        if (!/^1\d{10}$/.test(String(phone || ''))) throw new BadRequestException('手机号格式不正确');
        if (label && Array.from(label).length > 4) throw new BadRequestException('标签最多4个字');
    }

    private assertPartialInput(input: Partial<{ province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }>) {
        if (Object.prototype.hasOwnProperty.call(input, 'phone') && typeof input.phone !== 'undefined') {
            if (!/^1\d{10}$/.test(String(input.phone || ''))) throw new BadRequestException('手机号格式不正确');
        }
        if (input.label && Array.from(input.label).length > 4) throw new BadRequestException('标签最多4个字');
    }

    private normalize(input: Partial<{ province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }>) {
        const data: any = { ...input };
        if (typeof data.label === 'string') data.label = data.label.trim() || null;
        return data;
    }

    private normalizePartial(input: Partial<{ province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }>) {
        const data: any = { ...input };
        if (Object.prototype.hasOwnProperty.call(data, 'label')) {
            if (typeof data.label === 'string') data.label = data.label.trim() || null;
        }
        return data;
    }

    // ================= 管理端接口（POS 代客） =================
    private async getGuestMemberId(): Promise<number> {
        const gid = Number(process.env.GUEST_MEMBER_ID || (process as any)?.env?.GUESS_MEMBER_ID || 0);
        if (!Number.isFinite(gid) || gid <= 0) throw new BadRequestException('系统未配置 GUEST_MEMBER_ID');
        const m = await this.prisma.member.findUnique({ where: { id: gid }, select: { id: true } });
        if (!m) throw new BadRequestException('GUEST_MEMBER_ID 无效：未找到对应会员');
        return gid;
    }

    async adminCreate(params: { memberId?: number | null; useGuest?: boolean; input: { province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null } }) {
        const memberId = params.useGuest ? await this.getGuestMemberId() : Number(params.memberId || 0);
        if (!Number.isFinite(memberId) || memberId <= 0) throw new BadRequestException('缺少有效的 memberId');
        this.assertInput(params.input);
        const data = this.normalize(params.input);
        // 校验会员是否存在
        const exists = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
        if (!exists) throw new BadRequestException('会员不存在');
        return this.prisma.memberAddress.create({ data: { ...data, memberId } });
    }

    async adminUpdate(id: number, input: Partial<{ province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null }>) {
        const existing = await this.prisma.memberAddress.findUnique({ where: { id } });
        if (!existing) throw new BadRequestException('地址不存在');
        this.assertPartialInput(input);
        const data = this.normalizePartial(input);
        return this.prisma.memberAddress.update({ where: { id }, data });
    }

    async adminDelete(id: number) {
        const existing = await this.prisma.memberAddress.findUnique({ where: { id } });
        if (!existing) throw new BadRequestException('地址不存在');
        await this.prisma.memberAddress.delete({ where: { id } });
        return { ok: true };
    }
}


