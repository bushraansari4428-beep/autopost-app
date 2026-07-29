import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-jwt-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    
    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }
    
    if (user.expiresAt && user.expiresAt < new Date()) {
      // Auto-delete the expired user
      await this.prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      throw new UnauthorizedException('User account has expired.');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
