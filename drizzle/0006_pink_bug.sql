CREATE TABLE `merchantPaymentConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`merchantIdEncrypted` text NOT NULL,
	`apiV3KeyEncrypted` text NOT NULL,
	`certificateSerial` varchar(64),
	`certificatePemEncrypted` text NOT NULL,
	`privateKeyPemEncrypted` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantPaymentConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantPaymentConfigs_restaurantId_unique` UNIQUE(`restaurantId`)
);
