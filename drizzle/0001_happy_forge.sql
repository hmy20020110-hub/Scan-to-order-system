CREATE TABLE `diningTables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`code` varchar(40) NOT NULL,
	`status` enum('available','occupied','disabled') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `diningTables_id` PRIMARY KEY(`id`),
	CONSTRAINT `diningTables_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `dishes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`priceCents` int NOT NULL,
	`imageUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isAvailable` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dishes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menuCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menuCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`dishId` int NOT NULL,
	`dishName` varchar(120) NOT NULL,
	`unitPriceCents` int NOT NULL,
	`quantity` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`tableId` int NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`status` enum('pending','confirmed','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
	`paymentStatus` enum('unpaid','pending','paid','refunded') NOT NULL DEFAULT 'unpaid',
	`totalCents` int NOT NULL,
	`customerNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`slogan` varchar(240),
	`address` varchar(240),
	`phone` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `restaurants_id` PRIMARY KEY(`id`)
);
