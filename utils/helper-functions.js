const { randomFileName, uploadFile, generateSignedUrl } = require('../utils/aws/aws-sdk-s3');
const { invalidateCloudFrontCache } = require('../utils/aws/aws-sdk-cloudfront');

function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

const pushUpdatedFields = async (body, fieldsToUpdate, file, object, imageField) => {
    const updatedFields = {};

    fieldsToUpdate.forEach((field) => {
        if (body[field]) {
            updatedFields[field] = body[field];
        }
    });

    if (file) {
        if (object[imageField]) {
            await uploadFile(object[imageField], file.buffer, file.mimetype);
            await invalidateCloudFrontCache(object[imageField]);
        } else {
            const imageName = randomFileName();
            await uploadFile(imageName, file.buffer, file.mimetype);
            updatedFields[imageField] = imageName;
        }
    }

    updatedFields.updatedAt = new Date();

    return updatedFields;
}

const pushUpdatedFieldsMessage = async (body, fieldsToUpdate, file, message) => {
    const updatedFields = {};

  if (body.message) {
    updatedFields.message = body.message;
  }

  if (file) {
    if (message.imageUrl) {
      await uploadFile(message.imageUrl, file.buffer, file.mimetype);
      await invalidateCloudFrontCache(message.imageUrl);
    } else if (message.fileUrl) {
      await uploadFile(message.fileUrl, file.buffer, file.mimetype);
      await invalidateCloudFrontCache(message.fileUrl);
    }
  }

  updatedFields.updatedAt = new Date();
}

const generateAvatarUrl = async(person) => {
  if (person.avatarName) {
    if (!isValidUrl(person.avatarName)) {
      person.avatarName = await generateSignedUrl(person.avatarName);
    }
  }
}

const generateImageOrFileUrl = async(address) => {
  if (address) {
    address = await generateSignedUrl(address);
  }
}

module.exports = {
    isValidEmail,
    pushUpdatedFields,
    pushUpdatedFieldsMessage,
    generateAvatarUrl,
    generateImageOrFileUrl,
};
