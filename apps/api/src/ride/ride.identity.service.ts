import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { extractBearerTokenFromHeaders } from '../auth/bearer.js';

@Injectable()
export class RideIdentityService {
	constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

	memberId(headers: Record<string, unknown>): number {
		const decoded = this.decode(headers);
		if (decoded.type !== 'member') throw new UnauthorizedException('会员身份无效');
		return decoded.id;
	}

	adminId(headers: Record<string, unknown>): number {
		const decoded = this.decode(headers);
		if (decoded.type !== 'admin') throw new UnauthorizedException('管理员身份无效');
		return decoded.id;
	}

	async enabledEmployee(memberId: number) {
		const employee = await this.prisma.employee.findUnique({
			where: { memberId },
			include: { member: { select: { id: true, name: true, phone: true } } },
		});
		if (!employee?.enabled) throw new ForbiddenException('仅启用状态的员工可使用内部司机功能');
		return employee;
	}

	private decode(headers: Record<string, unknown>) {
		const token = extractBearerTokenFromHeaders(headers as any);
		if (!token) throw new UnauthorizedException('未登录');
		try {
			const value: any = this.jwt.verify(token);
			const id = Number(value?.sub);
			const type = String(value?.type || '');
			if (!Number.isFinite(id) || id <= 0 || (type !== 'member' && type !== 'admin')) throw new Error('invalid identity');
			return { id, type };
		} catch {
			throw new UnauthorizedException('登录已过期');
		}
	}
}
