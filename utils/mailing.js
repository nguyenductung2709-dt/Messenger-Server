const nodemailer = require('nodemailer')
const { GOOGLE_USER, GOOGLE_PASS } = require('./config')

module.exports.sendingMail = async({from, to, subject, text}) =>{

  try {
    let mailOptions = ({
      from,
      to,
      subject,
      text
  });
  const Transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GOOGLE_USER,
        pass: GOOGLE_PASS
      },
    });

    return await Transporter.sendMail(mailOptions) 
  } catch (error) {
    console.log(error)
  }
}