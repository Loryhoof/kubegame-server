import { prisma } from "../db";

export const UserService = {
  async getProfile(userId: string) {
    const user = prisma.user.findUnique({ where: { id: userId } });

    prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    return user;
  },

  async updateCoins(userId: string, coins: number) {
    return prisma.user.update({ where: { id: userId }, data: { coins } });
  },

  async updateKillcount(userId: string, killCount: number) {
    return prisma.user.update({ where: { id: userId }, data: { killCount } });
  },

  async updateDeathcount(userId: string, deathCount: number) {
    return prisma.user.update({ where: { id: userId }, data: { deathCount } });
  },

  async updateNickname(userId: string, nickname: string) {
    return prisma.user.update({ where: { id: userId }, data: { nickname } });
  },
};

//
