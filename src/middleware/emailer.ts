// import nodemailer from 'nodemailer';
// import config from '../config';

// const transporter = nodemailer.createTransport({
//   // Configure your email service here
//   // Example for Gmail:
//   service: 'gmail',
//   auth: {
//     user: config.EMAIL_USER,
//     pass: config.EMAIL_PASS,
//   },
// });

// export const sendVerificationEmail = async (to: string, token: string) => {
//   const mailOptions = {
//     from: config.EMAIL_USER,
//     to: to,
//     subject: 'Email Verification',
//     text: `Please verify your email by clicking on this link: ${config.BASE_URL}/auth/verify/${token}`,
//   };

//   await transporter.sendMail(mailOptions);
// };