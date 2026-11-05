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

 router.post(
   "/:player_id/topup",
   async (req: Request<{ player_id: string }>, res: Response) => {
     const { amount } = req.body ?? {};

     // 1. Validasi jumlah top up
     if (!Number.isSafeInteger(amount) || amount <= 0) {
       return res.status(400).json({
         status: false,
         message: "amount harus bilangan bulat lebih dari 0",
       });
     }

     // 2. Ambil ID player dari URL
     const playerId = parsePlayerId(req.params.player_id);

     // 3. Cari player di database
     const player =
       playerId === null
         ? null
         : await prisma.player.findUnique({
             where: { id: playerId },
           });

     if (!player) {
       return res.status(404).json({
         status: false,
         message: "Player tidak ditemukan",
       });
     }

     // 4. Tambahkan saldo Diamond
     const updatedPlayer = await prisma.player.update({
       where: { id: player.id },
       data: {
         diamond: {
           increment: amount,
         },
       },
     });

     // 5. Kirim response
     return res.status(200).json({
       status: true,
       message: "Top up berhasil",
       data: {
         playerId: updatedPlayer.id,
         diamond: updatedPlayer.diamond,
       },
     });
   },
 );

 router.post(
  "/:player_id/matches",
  async (req: Request<{ player_id: string }>, res: Response) => {
    const { result } = req.body ?? {};

    // 1. Validasi hasil match
    if (result !== "WIN" && result !== "LOSE") {
      return res.status(400).json({
        status: false,
        message: "result harus WIN atau LOSE",
      });
    }

    // 2. Ambil ID player
    const playerId = parsePlayerId(req.params.player_id);

    // 3. Cari player
    const player =
      playerId === null
        ? null
        : await prisma.player.findUnique({
            where: { id: playerId },
          });

    if (!player) {
      return res.status(404).json({
        status: false,
        message: "Player tidak ditemukan",
      });
    }

    // 4. Menentukan hadiah BP
    const bpEarned = result === "WIN" ? 300 : 100;

    // 5. Menambahkan BP
    const updatedPlayer = await prisma.player.update({
      where: { id: player.id },
      data: {
        bp: {
          increment: bpEarned,
        },
      },
    });

    // 6. Response
    return res.status(200).json({
      status: true,
      message: "Hadiah match berhasil ditambahkan",
      data: {
        playerId: updatedPlayer.id,
        result,
        bpEarned,
        bp: updatedPlayer.bp,
      },
    });
  }
);

 router.post(
   "/:player_id/heroes",
   async (req: Request<{ player_id: string }>, res: Response) => {
     const { heroId, currency } = req.body ?? {};

     // VALIDASI 1: heroId dan currency harus valid
     if (
       !Number.isSafeInteger(heroId) ||
       heroId <= 0 ||
       (currency !== "BP" && currency !== "DIAMOND")
     ) {
       return res.status(400).json({
         status: false,
         message: "heroId harus valid dan currency harus BP atau DIAMOND",
       });
     }

     // VALIDASI 2: Player harus ditemukan
     const playerId = parsePlayerId(req.params.player_id);

     const player =
       playerId === null
         ? null
         : await prisma.player.findUnique({
             where: { id: playerId },
           });

     if (!player) {
       return res.status(404).json({
         status: false,
         message: "Player tidak ditemukan",
       });
     }

     // VALIDASI 3: Hero harus ditemukan
     const hero = await prisma.hero.findUnique({
       where: { id: heroId },
     });

     if (!hero) {
       return res.status(404).json({
         status: false,
         message: "Hero tidak ditemukan",
       });
     }

     // VALIDASI 4: Harga harus tersedia
     const price =
       currency === "BP"
         ? hero.priceBP
         : hero.priceDiamond;

     if (price == null || price <= 0) {
       return res.status(400).json({
         status: false,
         message: `Hero tidak bisa dibeli dengan ${currency}`,
       });
     }

     // VALIDASI 5: Hero belum dimiliki player
     const existingHero = await prisma.playerHero.findUnique({
       where: {
         playerId_heroId: {
           playerId: player.id,
           heroId: hero.id,
         },
       },
     });

     if (existingHero) {
       return res.status(409).json({
         status: false,
         message: "Player sudah memiliki hero tersebut",
       });
     }

     // VALIDASI 6: Saldo harus mencukupi
     const balance =
       currency === "BP"
         ? player.bp
         : player.diamond;

     if (balance < price) {
       return res.status(400).json({
         status: false,
         message: `Saldo ${currency} tidak mencukupi`,
       });
     }

     // TRANSACTION:
     // Kurangi saldo dan catat hero secara bersamaan
     try {
       const [updatedPlayer, purchasedHero] =
         await prisma.$transaction([
           prisma.player.update({
             where: { id: player.id },
             data:
               currency === "BP"
                 ? { bp: { decrement: price } }
                 : { diamond: { decrement: price } },
           }),

           prisma.playerHero.create({
             data: {
               playerId: player.id,
               heroId: hero.id,
               currency,
               pricePaid: price,
             },
           }),
         ]);

       return res.status(201).json({
         status: true,
         message: "Hero berhasil dibeli",
         data: {
           hero: {
             id: hero.id,
             name: hero.name,
           },
           currency: purchasedHero.currency,
           price: purchasedHero.pricePaid,
           balance: {
             bp: updatedPlayer.bp,
             diamond: updatedPlayer.diamond,
           },
         },
       });

     } catch (error) {
       // Menangani pembelian hero duplikat
       if (isUniqueError(error)) {
         return res.status(409).json({
           status: false,
           message: "Player sudah memiliki hero tersebut",
         });
       }

       throw error;
     }
   },
 );
 
export default router;
