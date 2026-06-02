import express from "express";
import { prisma, toJson, idParam, dateValue } from "./db.js";
import { createSession, hashToken, requireAuth, verifyPassword } from "./auth.js";

export const router = express.Router();

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const activeFilter = (includeInactive) =>
  includeInactive === "true" ? {} : { isActive: true };

async function ensureStock(tx, memberId) {
  return tx.memberIncenseStock.upsert({
    where: { memberId },
    update: {},
    create: { memberId }
  });
}

async function adjustStock(tx, memberId, delta, note, registrationId = null) {
  const current = await ensureStock(tx, memberId);
  const next = {
    fortuneIncenseQty: current.fortuneIncenseQty + (delta.fortuneIncenseDelta || 0),
    jadeIncenseQty: current.jadeIncenseQty + (delta.jadeIncenseDelta || 0),
    goldIngotIncenseQty: current.goldIngotIncenseQty + (delta.goldIngotIncenseDelta || 0)
  };
  if (next.fortuneIncenseQty < 0 || next.jadeIncenseQty < 0 || next.goldIngotIncenseQty < 0) {
    const error = new Error("Incense stock cannot be negative");
    error.status = 400;
    throw error;
  }

  await tx.memberIncenseStock.update({
    where: { memberId },
    data: next
  });

  await tx.incenseStockLog.create({
    data: {
      memberId,
      registrationId,
      changeType: delta.changeType || "adjust",
      fortuneIncenseDelta: delta.fortuneIncenseDelta || 0,
      jadeIncenseDelta: delta.jadeIncenseDelta || 0,
      goldIngotIncenseDelta: delta.goldIngotIncenseDelta || 0,
      note
    }
  });
}

function registrationInclude() {
  return {
    member: true,
    plan: true,
    payments: { include: { remittanceRecord: true } }
  };
}

async function paidAmount(registrationId) {
  const aggregate = await prisma.registrationPayment.aggregate({
    where: { registrationId },
    _sum: { appliedAmount: true }
  });
  return aggregate._sum.appliedAmount || 0;
}

router.post("/auth/login", asyncRoute(async (req, res) => {
  const { username, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await verifyPassword(password || "", admin.passwordHash))) {
    return res.status(401).json({ message: "Invalid username or password" });
  }
  const session = await createSession(admin.id);
  res.json(toJson({
    token: session.token,
    expires_at: session.expiresAt,
    admin: { id: admin.id, username: admin.username }
  }));
}));

router.post("/auth/logout", requireAuth, asyncRoute(async (req, res) => {
  await prisma.adminSession.delete({ where: { id: req.session.id } });
  res.json({ ok: true });
}));

router.get("/auth/me", requireAuth, asyncRoute(async (req, res) => {
  res.json(toJson({ id: req.admin.id, username: req.admin.username }));
}));

router.use(requireAuth);

router.get("/members", asyncRoute(async (req, res) => {
  const members = await prisma.member.findMany({
    where: activeFilter(req.query.include_inactive),
    include: { bankAccounts: true, incenseStock: true },
    orderBy: { id: "desc" }
  });
  res.json(toJson(members));
}));

router.post("/members", asyncRoute(async (req, res) => {
  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: { name: req.body.name, note: req.body.note || "" }
    });
    await ensureStock(tx, created.id);
    return created;
  });
  res.status(201).json(toJson(member));
}));

router.get("/members/:id", asyncRoute(async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: idParam(req.params.id) },
    include: { bankAccounts: true, incenseStock: true, registrations: { include: { plan: true } } }
  });
  if (!member) return res.status(404).json({ message: "Not found" });
  res.json(toJson(member));
}));

router.put("/members/:id", asyncRoute(async (req, res) => {
  const member = await prisma.member.update({
    where: { id: idParam(req.params.id) },
    data: {
      name: req.body.name,
      note: req.body.note || "",
      isActive: req.body.is_active ?? req.body.isActive ?? true
    }
  });
  res.json(toJson(member));
}));

router.delete("/members/:id", asyncRoute(async (req, res) => {
  const member = await prisma.member.update({
    where: { id: idParam(req.params.id) },
    data: { isActive: false }
  });
  res.json(toJson(member));
}));

router.get("/members/:id/summary", asyncRoute(async (req, res) => {
  const memberId = idParam(req.params.id);
  const [member, stock, registrations] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, include: { bankAccounts: true } }),
    prisma.memberIncenseStock.findUnique({ where: { memberId } }),
    prisma.registration.findMany({ where: { memberId }, include: registrationInclude(), orderBy: { participationDate: "desc" } })
  ]);
  if (!member) return res.status(404).json({ message: "Not found" });
  res.json(toJson({ member, stock, registrations }));
}));

router.get("/members/:memberId/bank-accounts", asyncRoute(async (req, res) => {
  const items = await prisma.memberBankAccount.findMany({
    where: { memberId: idParam(req.params.memberId) },
    orderBy: { id: "desc" }
  });
  res.json(toJson(items));
}));

router.post("/members/:memberId/bank-accounts", asyncRoute(async (req, res) => {
  const item = await prisma.memberBankAccount.create({
    data: {
      memberId: idParam(req.params.memberId),
      bankLast5: req.body.bank_last5 || req.body.bankLast5,
      note: req.body.note || ""
    }
  });
  res.status(201).json(toJson(item));
}));

router.put("/member-bank-accounts/:id", asyncRoute(async (req, res) => {
  const item = await prisma.memberBankAccount.update({
    where: { id: idParam(req.params.id) },
    data: {
      bankLast5: req.body.bank_last5 || req.body.bankLast5,
      note: req.body.note || ""
    }
  });
  res.json(toJson(item));
}));

router.delete("/member-bank-accounts/:id", asyncRoute(async (req, res) => {
  await prisma.memberBankAccount.delete({ where: { id: idParam(req.params.id) } });
  res.json({ ok: true });
}));

router.get("/member-bank-accounts/match", asyncRoute(async (req, res) => {
  const accounts = await prisma.memberBankAccount.findMany({
    where: { bankLast5: String(req.query.last5 || "") },
    include: { member: true }
  });
  const status = accounts.length === 1 ? "matched" : accounts.length > 1 ? "multiple_matches" : "unmatched";
  res.json(toJson({ status, members: accounts.map((account) => account.member) }));
}));

router.get("/plans", asyncRoute(async (req, res) => {
  const plans = await prisma.plan.findMany({
    where: activeFilter(req.query.include_inactive),
    orderBy: { id: "desc" }
  });
  res.json(toJson(plans));
}));

router.post("/plans", asyncRoute(async (req, res) => {
  const plan = await prisma.plan.create({ data: planData(req.body) });
  res.status(201).json(toJson(plan));
}));

router.get("/plans/:id", asyncRoute(async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: idParam(req.params.id) } });
  if (!plan) return res.status(404).json({ message: "Not found" });
  res.json(toJson(plan));
}));

router.put("/plans/:id", asyncRoute(async (req, res) => {
  const plan = await prisma.plan.update({ where: { id: idParam(req.params.id) }, data: planData(req.body) });
  res.json(toJson(plan));
}));

router.delete("/plans/:id", asyncRoute(async (req, res) => {
  const plan = await prisma.plan.update({ where: { id: idParam(req.params.id) }, data: { isActive: false } });
  res.json(toJson(plan));
}));

function planData(body) {
  return {
    name: body.name,
    amount: Number(body.amount || 0),
    fortuneIncenseDeductQty: Number(body.fortune_incense_deduct_qty ?? body.fortuneIncenseDeductQty ?? 0),
    jadeIncenseDeductQty: Number(body.jade_incense_deduct_qty ?? body.jadeIncenseDeductQty ?? 0),
    goldIngotIncenseDeductQty: Number(body.gold_ingot_incense_deduct_qty ?? body.goldIngotIncenseDeductQty ?? 0),
    cycleCount: Number(body.cycle_count ?? body.cycleCount ?? 1),
    sessionCount: Number(body.session_count ?? body.sessionCount ?? 1),
    isActive: body.is_active ?? body.isActive ?? true
  };
}

router.get("/members/:memberId/incense-stock", asyncRoute(async (req, res) => {
  const stock = await prisma.memberIncenseStock.findUnique({ where: { memberId: idParam(req.params.memberId) } });
  res.json(toJson(stock));
}));

router.post("/members/:memberId/incense-stock/adjust", asyncRoute(async (req, res) => {
  const memberId = idParam(req.params.memberId);
  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, memberId, {
      changeType: "adjust",
      fortuneIncenseDelta: Number(req.body.fortune_incense_delta ?? req.body.fortuneIncenseDelta ?? 0),
      jadeIncenseDelta: Number(req.body.jade_incense_delta ?? req.body.jadeIncenseDelta ?? 0),
      goldIngotIncenseDelta: Number(req.body.gold_ingot_incense_delta ?? req.body.goldIngotIncenseDelta ?? 0)
    }, req.body.note || "manual adjust");
  });
  const stock = await prisma.memberIncenseStock.findUnique({ where: { memberId } });
  res.json(toJson(stock));
}));

router.get("/members/:memberId/incense-stock/logs", asyncRoute(async (req, res) => {
  const logs = await prisma.incenseStockLog.findMany({
    where: { memberId: idParam(req.params.memberId) },
    orderBy: { id: "desc" }
  });
  res.json(toJson(logs));
}));

router.get("/registrations", asyncRoute(async (req, res) => {
  const where = req.query.date ? { participationDate: dateValue(req.query.date) } : {};
  const items = await prisma.registration.findMany({ where, include: registrationInclude(), orderBy: { id: "desc" } });
  res.json(toJson(items));
}));

router.post("/registrations", asyncRoute(async (req, res) => {
  const registration = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: BigInt(req.body.plan_id || req.body.planId) } });
    if (!plan) {
      const error = new Error("Plan not found");
      error.status = 404;
      throw error;
    }
    const memberId = BigInt(req.body.member_id || req.body.memberId);
    const created = await tx.registration.create({
      data: {
        memberId,
        planId: plan.id,
        participationDate: dateValue(req.body.participation_date || req.body.participationDate),
        paymentMethod: req.body.payment_method || req.body.paymentMethod,
        expectedAmount: plan.amount,
        status: "registered"
      },
      include: registrationInclude()
    });

    if (created.paymentMethod === "incense_deduct") {
      await adjustStock(tx, memberId, {
        changeType: "deduct",
        fortuneIncenseDelta: -plan.fortuneIncenseDeductQty,
        jadeIncenseDelta: -plan.jadeIncenseDeductQty,
        goldIngotIncenseDelta: -plan.goldIngotIncenseDeductQty
      }, `registration ${created.id}`, created.id);
    }

    return created;
  });
  res.status(201).json(toJson(registration));
}));

router.get("/registrations/by-date", asyncRoute(async (req, res) => {
  const items = await prisma.registration.findMany({
    where: { participationDate: dateValue(req.query.date) },
    include: registrationInclude(),
    orderBy: { id: "desc" }
  });
  res.json(toJson(items));
}));

router.get("/registrations/:id", asyncRoute(async (req, res) => {
  const item = await prisma.registration.findUnique({ where: { id: idParam(req.params.id) }, include: registrationInclude() });
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(toJson(item));
}));

router.put("/registrations/:id", asyncRoute(async (req, res) => {
  const registrationId = idParam(req.params.id);
  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { plan: true }
    });
    if (!current) {
      const error = new Error("Registration not found");
      error.status = 404;
      throw error;
    }

    const nextPlanId = BigInt(req.body.plan_id || req.body.planId || current.planId);
    const nextPlan = await tx.plan.findUnique({ where: { id: nextPlanId } });
    if (!nextPlan) {
      const error = new Error("Plan not found");
      error.status = 404;
      throw error;
    }

    const nextPaymentMethod = req.body.payment_method || req.body.paymentMethod || current.paymentMethod;

    if (current.paymentMethod === "incense_deduct") {
      await adjustStock(tx, current.memberId, {
        changeType: "adjust",
        fortuneIncenseDelta: current.plan.fortuneIncenseDeductQty,
        jadeIncenseDelta: current.plan.jadeIncenseDeductQty,
        goldIngotIncenseDelta: current.plan.goldIngotIncenseDeductQty
      }, `registration ${current.id} edit rollback`, current.id);
    }

    if (nextPaymentMethod === "incense_deduct") {
      await adjustStock(tx, current.memberId, {
        changeType: "deduct",
        fortuneIncenseDelta: -nextPlan.fortuneIncenseDeductQty,
        jadeIncenseDelta: -nextPlan.jadeIncenseDeductQty,
        goldIngotIncenseDelta: -nextPlan.goldIngotIncenseDeductQty
      }, `registration ${current.id} edit deduct`, current.id);
    }

    return tx.registration.update({
      where: { id: registrationId },
      data: {
        planId: nextPlan.id,
        participationDate: dateValue(req.body.participation_date || req.body.participationDate) || current.participationDate,
        paymentMethod: nextPaymentMethod,
        expectedAmount: nextPlan.amount,
        status: req.body.status || current.status
      },
      include: registrationInclude()
    });
  });
  res.json(toJson(item));
}));

router.delete("/registrations/:id", asyncRoute(async (req, res) => {
  const item = await prisma.registration.update({
    where: { id: idParam(req.params.id) },
    data: { status: "cancelled" }
  });
  res.json(toJson(item));
}));

router.get("/remittances", asyncRoute(async (req, res) => {
  const items = await prisma.remittanceRecord.findMany({
    include: { matchedMember: true, payments: true },
    orderBy: { id: "desc" }
  });
  res.json(toJson(items));
}));

router.post("/remittances", asyncRoute(async (req, res) => {
  const last5 = req.body.remittance_last5 || req.body.remittanceLast5;
  const matches = await prisma.memberBankAccount.findMany({
    where: { bankLast5: last5 },
    include: { member: true }
  });
  const matchStatus = matches.length === 1 ? "matched" : matches.length > 1 ? "multiple_matches" : "unmatched";
  const item = await prisma.remittanceRecord.create({
    data: {
      remittanceLast5: last5,
      matchedMemberId: matches.length === 1 ? matches[0].memberId : null,
      remittanceDate: dateValue(req.body.remittance_date || req.body.remittanceDate),
      participationDate: dateValue(req.body.participation_date || req.body.participationDate),
      amount: Number(req.body.amount || 0),
      matchStatus,
      note: req.body.note || ""
    },
    include: { matchedMember: true, payments: true }
  });
  res.status(201).json(toJson({ ...item, unappliedAmount: item.amount }));
}));

router.get("/remittances/:id", asyncRoute(async (req, res) => {
  const item = await prisma.remittanceRecord.findUnique({
    where: { id: idParam(req.params.id) },
    include: { matchedMember: true, payments: true }
  });
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(toJson(item));
}));

router.put("/remittances/:id", asyncRoute(async (req, res) => {
  const item = await prisma.remittanceRecord.update({
    where: { id: idParam(req.params.id) },
    data: {
      remittanceLast5: req.body.remittance_last5 || req.body.remittanceLast5,
      remittanceDate: dateValue(req.body.remittance_date || req.body.remittanceDate),
      participationDate: dateValue(req.body.participation_date || req.body.participationDate),
      amount: Number(req.body.amount || 0),
      note: req.body.note || ""
    }
  });
  res.json(toJson(item));
}));

router.delete("/remittances/:id", asyncRoute(async (req, res) => {
  await prisma.remittanceRecord.delete({ where: { id: idParam(req.params.id) } });
  res.json({ ok: true });
}));

router.get("/remittances/:id/available-registrations", asyncRoute(async (req, res) => {
  const remittance = await prisma.remittanceRecord.findUnique({ where: { id: idParam(req.params.id) } });
  if (!remittance) return res.status(404).json({ message: "Not found" });
  const items = await prisma.registration.findMany({
    where: {
      memberId: remittance.matchedMemberId || undefined,
      participationDate: remittance.participationDate,
      paymentMethod: "remittance",
      status: "registered"
    },
    include: registrationInclude()
  });
  res.json(toJson(items));
}));

router.get("/remittances/:id/allocations", asyncRoute(async (req, res) => {
  const items = await prisma.registrationPayment.findMany({
    where: { remittanceRecordId: idParam(req.params.id) },
    include: { registration: { include: { member: true, plan: true } } }
  });
  res.json(toJson(items));
}));

router.post("/registration-payments", asyncRoute(async (req, res) => {
  const remittanceRecordId = BigInt(req.body.remittance_record_id || req.body.remittanceRecordId);
  const allocations = req.body.allocations || [];
  const result = await prisma.$transaction(async (tx) => {
    const remittance = await tx.remittanceRecord.findUnique({
      where: { id: remittanceRecordId },
      include: { payments: true }
    });
    if (!remittance) {
      const error = new Error("Remittance not found");
      error.status = 404;
      throw error;
    }
    const alreadyApplied = remittance.payments.reduce((sum, item) => sum + item.appliedAmount, 0);
    const nextApplied = allocations.reduce((sum, item) => sum + Number(item.applied_amount || item.appliedAmount || 0), 0);
    if (alreadyApplied + nextApplied > remittance.amount) {
      const error = new Error("Applied amount exceeds remittance amount");
      error.status = 400;
      throw error;
    }
    const created = [];
    for (const allocation of allocations) {
      created.push(await tx.registrationPayment.create({
        data: {
          remittanceRecordId,
          registrationId: BigInt(allocation.registration_id || allocation.registrationId),
          appliedAmount: Number(allocation.applied_amount || allocation.appliedAmount || 0)
        }
      }));
    }
    return { remittance, created, appliedAmount: alreadyApplied + nextApplied };
  });
  res.status(201).json(toJson({
    remittanceRecordId,
    amount: result.remittance.amount,
    appliedAmount: result.appliedAmount,
    unappliedAmount: result.remittance.amount - result.appliedAmount,
    allocations: result.created
  }));
}));

router.put("/registration-payments/:id", asyncRoute(async (req, res) => {
  const item = await prisma.registrationPayment.update({
    where: { id: idParam(req.params.id) },
    data: { appliedAmount: Number(req.body.applied_amount || req.body.appliedAmount || 0) }
  });
  res.json(toJson(item));
}));

router.delete("/registration-payments/:id", asyncRoute(async (req, res) => {
  await prisma.registrationPayment.delete({ where: { id: idParam(req.params.id) } });
  res.json({ ok: true });
}));

router.get("/registrations/:registrationId/payments", asyncRoute(async (req, res) => {
  const items = await prisma.registrationPayment.findMany({
    where: { registrationId: idParam(req.params.registrationId) },
    include: { remittanceRecord: true }
  });
  res.json(toJson(items));
}));

router.get("/reports/daily-participations", asyncRoute(async (req, res) => {
  const date = dateValue(req.query.date);
  const registrations = await prisma.registration.findMany({
    where: { participationDate: date, status: "registered" },
    include: {
      member: { include: { incenseStock: true } },
      plan: true,
      payments: true
    },
    orderBy: { id: "asc" }
  });
  const items = registrations.map((registration) => {
    const paid = registration.payments.reduce((sum, item) => sum + item.appliedAmount, 0);
    const balance = paid - registration.expectedAmount;
    let paymentLight = "red";
    let paymentStatusText = "未付款";
    if (registration.paymentMethod === "incense_deduct") {
      paymentLight = "green";
      paymentStatusText = "香品扣抵";
    } else if (balance === 0) {
      paymentLight = "green";
      paymentStatusText = "已付清";
    } else if (balance < 0 && paid > 0) {
      paymentLight = "yellow";
      paymentStatusText = "部分付款";
    } else if (balance > 0) {
      paymentLight = "yellow";
      paymentStatusText = "溢付";
    }
    return {
      registrationId: registration.id,
      memberId: registration.memberId,
      memberName: registration.member.name,
      planName: registration.plan.name,
      paymentMethod: registration.paymentMethod,
      expectedAmount: registration.expectedAmount,
      paidAmount: paid,
      balance,
      paymentLight,
      paymentStatusText,
      incenseStock: registration.member.incenseStock
    };
  });
  res.json(toJson({ date: req.query.date, items }));
}));

router.get("/reports/unpaid", asyncRoute(async (_req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { paymentMethod: "remittance", status: "registered" },
    include: registrationInclude(),
    orderBy: { participationDate: "desc" }
  });
  const items = [];
  for (const registration of registrations) {
    const paid = await paidAmount(registration.id);
    if (paid < registration.expectedAmount) {
      items.push({ ...registration, paidAmount: paid, balance: paid - registration.expectedAmount });
    }
  }
  res.json(toJson(items));
}));

router.get("/reports/overpaid", asyncRoute(async (_req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { paymentMethod: "remittance", status: "registered" },
    include: registrationInclude(),
    orderBy: { participationDate: "desc" }
  });
  const items = [];
  for (const registration of registrations) {
    const paid = await paidAmount(registration.id);
    if (paid > registration.expectedAmount) {
      items.push({ ...registration, paidAmount: paid, balance: paid - registration.expectedAmount });
    }
  }
  res.json(toJson(items));
}));
