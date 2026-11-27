import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1795765488748 implements MigrationInterface {
    name = 'InitialSchema1795765488748'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('adopter', 'shelter_staff', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(320) NOT NULL, "name" character varying(200) NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'adopter', "shelter_id" uuid, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "shelters" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(200) NOT NULL, "email" character varying(320) NOT NULL, "phone" character varying(30), "address_line1" character varying(200), "city" character varying(100) NOT NULL, "region" character varying(100), "postal_code" character varying(20), "country" character(2) NOT NULL, CONSTRAINT "PK_91ad96be54ee26203d624b96f5f" PRIMARY KEY ("id")); COMMENT ON COLUMN "shelters"."country" IS 'ISO 3166-1 alpha-2'`);
        await queryRunner.query(`CREATE TABLE "pet_photos" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "url" character varying(2048) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "pet_id" uuid NOT NULL, CONSTRAINT "PK_0a7b8bd06eedbac790fadfe1f17" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa9917587f051e28bd2514a7c9" ON "pet_photos"  ("pet_id") `);
        await queryRunner.query(`CREATE TYPE "public"."pet_species" AS ENUM('dog', 'cat', 'rabbit', 'bird', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."pet_sex" AS ENUM('male', 'female', 'unknown')`);
        await queryRunner.query(`CREATE TYPE "public"."pet_size" AS ENUM('small', 'medium', 'large', 'extra_large')`);
        await queryRunner.query(`CREATE TYPE "public"."pet_status" AS ENUM('available', 'pending', 'adopted')`);
        await queryRunner.query(`CREATE TABLE "pets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "species" "public"."pet_species" NOT NULL, "breed" character varying(100), "sex" "public"."pet_sex" NOT NULL DEFAULT 'unknown', "size" "public"."pet_size" NOT NULL, "birth_date" date, "description" text, "status" "public"."pet_status" NOT NULL DEFAULT 'available', "shelter_id" uuid NOT NULL, CONSTRAINT "PK_d01e9e7b4ada753c826720bee8b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eacd3f034ca639adac514d84c1" ON "pets"  ("shelter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_87412e569fcf3f48eea5d39492" ON "pets"  ("status", "species") `);
        await queryRunner.query(`CREATE TYPE "public"."adoption_application_status" AS ENUM('submitted', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "adoption_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" "public"."adoption_application_status" NOT NULL DEFAULT 'submitted', "message" text, "pet_id" uuid NOT NULL, "applicant_id" uuid NOT NULL, CONSTRAINT "PK_649b9c0de2938e3cbbe653c7752" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_50b3ce45b2bc4adaebd149ee66" ON "adoption_applications"  ("applicant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_85bbf983a5bcd2e38c4cd97a8a" ON "adoption_applications"  ("pet_id", "applicant_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_36236d47764e7222c90a3d0a979" FOREIGN KEY ("shelter_id") REFERENCES "shelters"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pet_photos" ADD CONSTRAINT "FK_aa9917587f051e28bd2514a7c94" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pets" ADD CONSTRAINT "FK_eacd3f034ca639adac514d84c14" FOREIGN KEY ("shelter_id") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "adoption_applications" ADD CONSTRAINT "FK_ceff7adb5974df96bedb41330b4" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "adoption_applications" ADD CONSTRAINT "FK_50b3ce45b2bc4adaebd149ee662" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "adoption_applications" DROP CONSTRAINT "FK_50b3ce45b2bc4adaebd149ee662"`);
        await queryRunner.query(`ALTER TABLE "adoption_applications" DROP CONSTRAINT "FK_ceff7adb5974df96bedb41330b4"`);
        await queryRunner.query(`ALTER TABLE "pets" DROP CONSTRAINT "FK_eacd3f034ca639adac514d84c14"`);
        await queryRunner.query(`ALTER TABLE "pet_photos" DROP CONSTRAINT "FK_aa9917587f051e28bd2514a7c94"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_36236d47764e7222c90a3d0a979"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85bbf983a5bcd2e38c4cd97a8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50b3ce45b2bc4adaebd149ee66"`);
        await queryRunner.query(`DROP TABLE "adoption_applications"`);
        await queryRunner.query(`DROP TYPE "public"."adoption_application_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87412e569fcf3f48eea5d39492"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eacd3f034ca639adac514d84c1"`);
        await queryRunner.query(`DROP TABLE "pets"`);
        await queryRunner.query(`DROP TYPE "public"."pet_status"`);
        await queryRunner.query(`DROP TYPE "public"."pet_size"`);
        await queryRunner.query(`DROP TYPE "public"."pet_sex"`);
        await queryRunner.query(`DROP TYPE "public"."pet_species"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa9917587f051e28bd2514a7c9"`);
        await queryRunner.query(`DROP TABLE "pet_photos"`);
        await queryRunner.query(`DROP TABLE "shelters"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
    }

}
