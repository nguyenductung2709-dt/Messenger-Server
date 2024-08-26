const { CreateInvalidationCommand } = require("@aws-sdk/client-cloudfront");
const cloudfront = require("./cloudfront-client");
const { CLOUD_FRONT_DISTRIBUTION_ID } = require('../config')

const invalidateCloudFrontCache = async (Key) => {
    const cfCommand = new CreateInvalidationCommand({
        DistributionId: CLOUD_FRONT_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: Key,
          Paths: {
            Quantity: 1,
            Items: [
              "/" + Key
            ]
          }
        }
      })
      
    const response = await cloudfront.send(cfCommand)
    return response;
}

module.exports = {
    invalidateCloudFrontCache,
}

