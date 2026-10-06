ALTER TABLE "PaidMessageUnlock" DROP CONSTRAINT "PaidMessageUnlock_messageId_fkey";
ALTER TABLE "PaidMessageUnlock" ADD CONSTRAINT "PaidMessageUnlock_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_adult_fictional_check" CHECK ("age" >= 21 AND "fictional" = true);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_positive_price_check" CHECK ("price" > 0);
ALTER TABLE "CreatorPost" ADD CONSTRAINT "CreatorPost_nonnegative_price_check" CHECK ("price" >= 0 AND ("visibility" != 'PPV' OR "price" > 0));
ALTER TABLE "CreatorSettings" ADD CONSTRAINT "CreatorSettings_tip_bounds_check" CHECK ("tipMin" > 0 AND "tipMax" >= "tipMin" AND "paidMessagePrice" > 0 AND "requestStartingPrice" > 0);
