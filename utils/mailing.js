const nodemailer = require('nodemailer')

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
        user: process.env.GOOGLE_USER,
        pass: process.env.GOOGLE_PASS
      },
    });

    return await Transporter.sendMail(mailOptions) 
  } catch (error) {
    console.log(error)
  }
}