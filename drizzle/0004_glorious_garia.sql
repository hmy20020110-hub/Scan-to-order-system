CREATE TABLE `paymentTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('wechat','mock') NOT NULL,
	`orderId` int NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`transactionId` varchar(128) NOT NULL,
	`amountCents` int NOT NULL,
	`status` enum('success','failed','refunded') NOT NULL,
	`rawPayload` text,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_provider_transaction_unique` UNIQUE(`provider`,`transactionId`)
);
