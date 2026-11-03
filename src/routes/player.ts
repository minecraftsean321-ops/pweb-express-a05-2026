import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Router, type Request, type Response } from "express";
import { Prisma, PrismaClient } from "../generated/prisma/client";

const router = Router();
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED must be set to use the player routes.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

// Ubah :player_id jadi angka. Kalau bukan angka positif → null (dianggap player tidak ada)
function parsePlayerId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

// Ambil nickname dari body, hasilnya string yang sudah di-trim ('' kalau kosong / bukan string)
function readNickname(body: unknown): string {
  const nickname = (body as { nickname?: unknown } | undefined)?.nickname;
  return typeof nickname === "string" ? nickname.trim() : "";
}

// Cek error unique constraint dari Prisma (nickname kembar)
function isUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// 1. Create Player (POST /api/players)
router.post("/", async (req: Request, res: Response) => {
  const nickname = readNickname(req.body);

  // nickname kosong → 400
  if (!nickname) {
    return res
      .status(400)
      .json({ status: false, message: "nickname wajib diisi" });
  }

  // nickname sudah dipakai → 409
  const existing = await prisma.player.findUnique({ where: { nickname } });
  if (existing) {
    return res
      .status(409)
      .json({ status: false, message: `Nickname ${nickname} sudah dipakai` });
  }

  try {
    // bp = 10000 dan diamond = 0 otomatis dari @default di schema
    const player = await prisma.player.create({ data: { nickname } });
    return res
      .status(201)
      .json({ status: true, message: "Player berhasil dibuat", data: player });
  } catch (error) {
    if (isUniqueError(error)) {
      return res
        .status(409)
        .json({ status: false, message: `Nickname ${nickname} sudah dipakai` });
    }
    throw error;
  }
});

// 2. Get Player Detail (GET /api/players/:player_id)
router.get(
  "/:player_id",
  async (req: Request<{ player_id: string }>, res: Response) => {
    const playerId = parsePlayerId(req.params.player_id);

    const player =
      playerId === null
        ? null
        : await prisma.player.findUnique({
            where: { id: playerId },
            include: {
              // Ambil hero yang dimiliki + nama hero-nya
              playerHeroes: {
                include: { hero: { select: { name: true } } },
                orderBy: { id: "asc" },
              },
            },
          });

    if (!player) {
      return res
        .status(404)
        .json({ status: false, message: "Player tidak ditemukan" });
    }

    // Rapikan bentuk data sesuai contoh modul
    const { playerHeroes, ...playerData } = player;
    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil data player",
      data: {
        ...playerData,
        heroes: playerHeroes.map((ph) => ({
          heroId: ph.heroId,
          name: ph.hero.name,
          currency: ph.currency,
          pricePaid: ph.pricePaid,
        })),
      },
    });
  },
);

// 3. Update Player (PATCH /api/players/:player_id)
router.patch(
  "/:player_id",
  async (req: Request<{ player_id: string }>, res: Response) => {
    const playerId = parsePlayerId(req.params.player_id);

    // Urutan cek: player tidak ada → 404
    const player =
      playerId === null
        ? null
        : await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res
        .status(404)
        .json({ status: false, message: "Player tidak ditemukan" });
    }

    // nickname kosong → 400
    const nickname = readNickname(req.body);
    if (!nickname) {
      return res
        .status(400)
        .json({ status: false, message: "nickname wajib diisi" });
    }

    // nickname sudah dipakai player LAIN → 409
    const owner = await prisma.player.findUnique({ where: { nickname } });
    if (owner && owner.id !== player.id) {
      return res
        .status(409)
        .json({
          status: false,
          message: `Nickname ${nickname} sudah dipakai player lain`,
        });
    }

    try {
      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { nickname },
      });
      return res
        .status(200)
        .json({
          status: true,
          message: "Player berhasil diperbarui",
          data: updated,
        });
    } catch (error) {
      if (isUniqueError(error)) {
        return res
          .status(409)
          .json({
            status: false,
            message: `Nickname ${nickname} sudah dipakai player lain`,
          });
      }
      throw error;
    }
  },
);

// 4. Delete Player (DELETE /api/players/:player_id)
router.delete(
  "/:player_id",
  async (req: Request<{ player_id: string }>, res: Response) => {
    const playerId = parsePlayerId(req.params.player_id);

    const player =
      playerId === null
        ? null
        : await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res
        .status(404)
        .json({ status: false, message: "Player tidak ditemukan" });
    }

    // PlayerHero milik player ikut terhapus otomatis karena onDelete: Cascade
    const deleted = await prisma.player.delete({ where: { id: player.id } });
    return res
      .status(200)
      .json({
        status: true,
        message: "Player berhasil dihapus",
        data: deleted,
      });
  },
);

export default router;
