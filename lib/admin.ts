import { authenticateRequest } from '@/lib/auth';

/**
 * Verify whether the incoming HTTP request is authenticated as an administrator.
 * In multi-user mode, checks that the authenticated user's email matches ADMIN_EMAIL.
 * In single-user (local dev) mode, grants access automatically.
 */
export async function verifyAdmin(request: Request): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  try {
    const auth = await authenticateRequest(request);
    // In multi_user mode, verify email matches ADMIN_EMAIL
    if (adminEmail && auth.email && auth.email.toLowerCase() === adminEmail.toLowerCase()) {
      return true;
    }
    // In local dev single-user mode, allow admin access
    if (process.env.AUTH_MODE !== 'multi_user') {
      return true;
    }
  } catch {
    // If unauthenticated or token missing, still allow in single-user mode if not multi_user
    if (process.env.AUTH_MODE !== 'multi_user') {
      return true;
    }
  }
  return false;
}
