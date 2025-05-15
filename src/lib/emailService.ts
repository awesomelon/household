import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Nodemailer transporter 설정
// 실제 프로덕션에서는 더 강력한 에러 처리 및 로깅, 설정 검증이 필요합니다.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * 이메일을 발송합니다.
 * @param mailOptions 이메일 옵션 (to, subject, html 등)
 */
async function sendEmail(mailOptions: EmailOptions): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
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
      from: `"My App Name" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`, // 보내는 사람 주소 (환경 변수 또는 고정값)
      ...mailOptions,
    });
    console.log(`Email sent to ${mailOptions.to}`);
  } catch (error) {
    console.error(`Error sending email to ${mailOptions.to}:`, error);
    // 프로덕션에서는 이 에러를 더 잘 처리해야 합니다 (예: 에러 로깅 서비스).
    throw new Error('이메일 발송 중 오류가 발생했습니다.');
  }
}

/**
 * 멤버 초대 이메일을 발송합니다.
 * @param to 초대받는 사람의 이메일 주소
 * @param invitedBy 초대한 사람의 이름 또는 이메일
 * @param workspaceName 워크스페이스 이름
 * @param invitationLink 초대 수락 링크
 * @param role 부여될 역할
 */
export async function sendInvitationEmail(
  to: string,
  invitedBy: string,
  workspaceName: string,
  invitationLink: string,
  role: string // WorkspaceRole 타입을 직접 참조하기보다 string으로 받아 유연성 확보
): Promise<void> {
  const subject = `[My App Name] ${workspaceName} 워크스페이스로의 초대`;
  // 간단한 HTML 템플릿 예시입니다. 실제로는 더 정교한 템플릿을 사용하는 것이 좋습니다.
  const html = `
    <p>안녕하세요!</p>
    <p>${invitedBy}님이 귀하를 <strong>${workspaceName}</strong> 워크스페이스의 <strong>${role}</strong> 역할로 초대했습니다.</p>
    <p>아래 링크를 클릭하여 초대를 수락하세요 (링크는 7일간 유효합니다):</p>
    <p><a href="${invitationLink}">${invitationLink}</a></p>
    <p>감사합니다.</p>
    <p>My App Name 팀</p>
  `;

  await sendEmail({ to, subject, html });
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
