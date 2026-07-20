import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    let user = await this.prisma.user.findUnique({ where: { email } });
    
    // Auto-create default admin account on first login attempt if it doesn't exist
    if (!user && email.toLowerCase() === 'noorali8657@gmail.com' && pass === 'Pakistan@5847') {
      user = await this.prisma.user.create({
        data: {
          email,
          password: pass,
          role: 'ADMIN',
        }
      });
    }

    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async register(email: string, pass: string): Promise<any> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new UnauthorizedException('Email already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        password: pass,
        role: email.toLowerCase() === 'noorali8657@gmail.com' ? 'ADMIN' : 'USER',
      }
    });
    
    return this.login(user);
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { resetToken: token } });
    if (!user) {
      throw new BadRequestException('Invalid token');
    }
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Token expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        password: newPassword, // Use bcrypt in prod
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    return { message: 'Password has been successfully reset' };
  }
}
