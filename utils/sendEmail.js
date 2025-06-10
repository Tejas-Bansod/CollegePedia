/**
 * @file utils/sendEmail.js
 * @description Utility function to send emails using Nodemailer with a custom SMTP server.
 * @module utils/sendEmail
 */
const nodemailer = require('nodemailer');

/**
 * Sends an email using Nodemailer with a custom SMTP server
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 * @returns {Promise<void>} Resolves when email is sent
 * @throws {Error} If email sending fails
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Create Nodemailer transporter with custom SMTP settings
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com', // Default to Gmail for example
      port: process.env.SMTP_PORT || 587, // Common TLS port (465 for SSL)
      secure: process.env.SMTP_PORT == 465, // True for SSL (port 465), false for TLS (port 587)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"tejasbansod584@gmail.com"`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Email sending error:', {
      message: error.message,
      to,
    });
    throw new Error('Failed to send email');
  }
};

module.exports = sendEmail;