'use strict';

import express, { Request, Response } from 'express';
import { corePrisma } from '@workspace/db-180core';
import { optionalAuth } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * POST /api/v1/support/tickets
 * Ingests support ticket from floating widget or contact forms.
 * Captures environment telemetry, clipboard screenshots (up to 5), and up to 1000 lines of description.
 */
router.post('/tickets', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category = 'BUG_REPORT',
      priority = 'MEDIUM',
      pageUrl,
      referrer,
      deviceInfo,
      consoleLogs,
      attachments = [],
      userName,
      userEmail,
      userId,
      appId,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Ticket title and description are required',
      });
    }

    // Determine user context if authenticated
    const effectiveUserId = (req as any).user?.id || userId || null;
    const effectiveUserName = (req as any).user?.name || userName || null;
    const effectiveUserEmail = (req as any).user?.email || userEmail || null;

    // Detect client IP and country header if available
    const userIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';
    const country =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-country-code'] as string) ||
      (req.headers['x-vercel-ip-country'] as string) ||
      deviceInfo?.country ||
      '';
    const timezone = deviceInfo?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Limit attachments to max 5 images
    const sanitizedAttachments = Array.isArray(attachments) ? attachments.slice(0, 5) : [];

    const ticket = await corePrisma.supportTicket.create({
      data: {
        title: String(title).slice(0, 255),
        description: String(description),
        category: String(category).toUpperCase(),
        priority: String(priority).toUpperCase(),
        status: 'OPEN',
        pageUrl: String(pageUrl || req.headers['referer'] || ''),
        referrer: String(referrer || ''),
        userIp,
        country,
        timezone,
        deviceInfo: deviceInfo || {},
        consoleLogs: consoleLogs || [],
        attachments: sanitizedAttachments,
        userId: effectiveUserId,
        appId: appId || null,
        userName: effectiveUserName,
        userEmail: effectiveUserEmail,
      },
    });

    console.log(
      `[SupportRoutes] New ticket created: #${ticket.ticketNumber} "${ticket.title}" from ${userEmail || 'anonymous'}`
    );

    return res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      message: `Support inquiry #${ticket.ticketNumber} received successfully. Our engineering team has been notified.`,
    });
  } catch (err: any) {
    console.error('[SupportRoutes:createTicket] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to submit support inquiry',
    });
  }
});

/**
 * GET /api/v1/support/tickets
 * Query tickets (supports filters: status, priority, category)
 */
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const { status, priority, category, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = String(status);
    if (priority && priority !== 'ALL') where.priority = String(priority);
    if (category && category !== 'ALL') where.category = String(category);
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { userEmail: { contains: String(search), mode: 'insensitive' } },
        { userName: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const [tickets, total] = await Promise.all([
      corePrisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      corePrisma.supportTicket.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      tickets,
      total,
      page: Number(page) || 1,
      totalPages: Math.ceil(total / take),
    });
  } catch (err: any) {
    console.error('[SupportRoutes:listTickets] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/support/tickets/:id
 * Retrieve full ticket details including environment telemetry and screenshots
 */
router.get('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const ticket = await corePrisma.supportTicket.findUnique({
      where: { id: req.params.id },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    return res.status(200).json({ success: true, ticket });
  } catch (err: any) {
    console.error('[SupportRoutes:getTicket] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/v1/support/tickets/:id
 * Update status, priority, or add admin notes
 */
router.patch('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const { status, priority, adminNotes, assignedAdminId } = req.body;

    const updateData: any = {};
    if (status) {
      updateData.status = String(status).toUpperCase();
      if (updateData.status === 'RESOLVED' || updateData.status === 'CLOSED') {
        updateData.resolvedAt = new Date();
      }
    }
    if (priority) updateData.priority = String(priority).toUpperCase();
    if (adminNotes !== undefined) updateData.adminNotes = String(adminNotes);
    if (assignedAdminId !== undefined) updateData.assignedAdminId = assignedAdminId;

    const updated = await corePrisma.supportTicket.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      ticket: updated,
      message: 'Ticket updated successfully',
    });
  } catch (err: any) {
    console.error('[SupportRoutes:updateTicket] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
