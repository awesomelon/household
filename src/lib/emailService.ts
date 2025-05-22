import nodemailer from 'nodemailer';
import { WorkspaceRole } from '@prisma/client';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Nodemailer transporter 설정
// 실제 프로덕션에서는 더 강력한 에러 처리 및 로깅, 설정 검증이 필요합니다.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // tls: {
  //   ciphers:'SSLv3' // 간혹 TLS 협상 문제시 필요할 수 있음
  // }
});

/**
 * 이메일을 발송합니다.
 * @param mailOptions 이메일 옵션 (to, subject, html 등)
 */
async function sendMail(mailOptions: MailOptions): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error(
      'SMTP 설정이 환경 변수에 올바르게 구성되지 않았습니다. 이메일을 발송할 수 없습니다.'
    );
    // 개발 환경에서는 에러를 던지는 대신 콘솔에만 출력하고,
    // 실제 발송이 필요한 경우 throw new Error('SMTP 미설정'); 등으로 처리할 수 있습니다.
    // 여기서는 로컬 개발 편의성을 위해 에러를 던지지 않습니다.
    return;
  }
  try {
    await transporter.sendMail({
      ...mailOptions,
      from: process.env.EMAIL_FROM || 'noreply@gmail.com', // 발신자 주소
    });
    console.log('Email sent successfully to:', mailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    // 프로덕션에서는 더 견고한 에러 로깅 및 처리 필요
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

/**
 * 멤버 초대 이메일을 발송합니다.
 * @param inviteeEmail 초대받는 사람의 이메일 주소
 * @param inviterName 초대한 사람의 이름
 * @param workspaceName 워크스페이스 이름
 * @param invitationLink 초대 수락 링크
 * @param role 부여될 역할
 */
export async function sendInvitationEmail(
  inviteeEmail: string,
  inviterName: string,
  workspaceName: string,
  invitationLink: string,
  role: WorkspaceRole
): Promise<void> {
  const subject = `${inviterName}님이 ${workspaceName} 워크스페이스에 초대합니다.`;
  const text = `안녕하세요, ${inviteeEmail}님.\n\n${inviterName}님이 당신을 [${workspaceName}] 워크스페이스의 ${role} 역할로 초대했습니다.\n초대를 수락하려면 다음 링크를 클릭하세요: ${invitationLink}\n\n이 링크는 7일 후에 만료됩니다.\n\n이 초대를 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.`;
  const html = `
    <p>안녕하세요, ${inviteeEmail}님.</p>
    <p>${inviterName}님이 당신을 <strong>${workspaceName}</strong> 워크스페이스의 <strong>${role}</strong> 역할로 초대했습니다.</p>
    <p>초대를 수락하려면 아래 버튼을 클릭하세요:</p>
    <p><a href="${invitationLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">초대 수락하기</a></p>
    <p>또는 다음 링크를 브라우저에 복사하여 붙여넣으세요: <a href="${invitationLink}">${invitationLink}</a></p>
    <p><em>이 링크는 7일 후에 만료됩니다.</em></p>
    <hr>
    <p style="font-size: 0.9em; color: #666;">이 초대를 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.</p>
  `;

  await sendMail({ to: inviteeEmail, subject, text, html });
}

// 이메일 서버 연결 상태 확인 (선택 사항)
if (process.env.NODE_ENV !== 'test') {
  // 테스트 환경에서는 실행하지 않음
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP 서버 연결 실패:', error);
    } else {
      console.log('SMTP 서버가 성공적으로 연결되었습니다. 이메일 발송 준비 완료.');
    }
  });
}
