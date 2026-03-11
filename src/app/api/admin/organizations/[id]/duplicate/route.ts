import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/admin/organizations/[id]/duplicate
 *
 * Duplicates an organization with all its configuration data.
 * When `includeTransactions` is true, also copies transactional data
 * (customers, suppliers, invoices, payments, stock, journal entries, etc.).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const newName = body.name?.trim();
        const newSlug = body.slug?.trim();
        const includeTransactions = body.includeTransactions === true;

        if (!newName || !newSlug) {
            return NextResponse.json(
                { error: "Name and slug are required for the duplicate" },
                { status: 400 }
            );
        }

        if (!/^[a-z0-9-]+$/.test(newSlug)) {
            return NextResponse.json(
                { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
                { status: 400 }
            );
        }

        // Check slug uniqueness
        const existingSlug = await prisma.organization.findUnique({
            where: { slug: newSlug },
        });
        if (existingSlug) {
            return NextResponse.json(
                { error: "An organization with this slug already exists" },
                { status: 409 }
            );
        }

        // Fetch source organization
        const sourceOrg = await prisma.organization.findUnique({
            where: { id },
        });

        if (!sourceOrg) {
            return NextResponse.json(
                { error: "Source organization not found" },
                { status: 404 }
            );
        }

        // Run all duplication in a transaction
        const newOrg = await prisma.$transaction(
            async (tx) => {
                // ═══════════════════════════════════════════════════════════════
                // 1. Create the new organization with same config
                // ═══════════════════════════════════════════════════════════════
                const org = await tx.organization.create({
                    data: {
                        name: newName,
                        slug: newSlug,
                        gstEnabled: sourceOrg.gstEnabled,
                        eInvoicingEnabled: sourceOrg.eInvoicingEnabled,
                        multiUnitEnabled: sourceOrg.multiUnitEnabled,
                        multiBranchEnabled: sourceOrg.multiBranchEnabled,
                        isMobileShopModuleEnabled: sourceOrg.isMobileShopModuleEnabled,
                        isWeighMachineEnabled: sourceOrg.isWeighMachineEnabled,
                        weighMachineBarcodePrefix: sourceOrg.weighMachineBarcodePrefix,
                        weighMachineProductCodeLen: sourceOrg.weighMachineProductCodeLen,
                        weighMachineWeightDigits: sourceOrg.weighMachineWeightDigits,
                        weighMachineDecimalPlaces: sourceOrg.weighMachineDecimalPlaces,
                        gstin: null, // Don't copy tax IDs – unique per org
                        gstStateCode: sourceOrg.gstStateCode,
                        saudiEInvoiceEnabled: sourceOrg.saudiEInvoiceEnabled,
                        vatNumber: null,
                        commercialRegNumber: null,
                        arabicName: sourceOrg.arabicName,
                        arabicAddress: null,
                        arabicCity: sourceOrg.arabicCity,
                        pdfHeaderImageUrl: sourceOrg.pdfHeaderImageUrl,
                        pdfFooterImageUrl: sourceOrg.pdfFooterImageUrl,
                        brandColor: sourceOrg.brandColor,
                        invoiceLogoHeight: sourceOrg.invoiceLogoHeight,
                        posReceiptLogoUrl: sourceOrg.posReceiptLogoUrl,
                        posReceiptLogoHeight: sourceOrg.posReceiptLogoHeight,
                        posAccountingMode: sourceOrg.posAccountingMode,
                        isTaxInclusivePrice: sourceOrg.isTaxInclusivePrice,
                        language: sourceOrg.language,
                        currency: sourceOrg.currency,
                    },
                });

                const N = org.id; // new org ID shorthand

                // ═══════════════════════════════════════════════════════════════
                // 2. Duplicate Settings
                // ═══════════════════════════════════════════════════════════════
                const settings = await tx.setting.findMany({
                    where: { organizationId: id },
                });
                if (settings.length > 0) {
                    await tx.setting.createMany({
                        data: settings.map((s) => ({
                            key: s.key,
                            value: s.value,
                            organizationId: N,
                        })),
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // 3. Duplicate Accounts (Chart of Accounts)
                // ═══════════════════════════════════════════════════════════════
                const accounts = await tx.account.findMany({
                    where: { organizationId: id },
                    orderBy: { code: "asc" },
                });

                const accountIdMap = new Map<string, string>();

                // First pass — create without parents
                for (const acct of accounts) {
                    const newAcct = await tx.account.create({
                        data: {
                            code: acct.code,
                            name: acct.name,
                            accountType: acct.accountType,
                            accountSubType: acct.accountSubType,
                            description: acct.description,
                            isSystem: acct.isSystem,
                            isActive: acct.isActive,
                            organizationId: N,
                        },
                    });
                    accountIdMap.set(acct.id, newAcct.id);
                }

                // Second pass — wire up parents
                for (const acct of accounts) {
                    if (acct.parentId && accountIdMap.has(acct.parentId)) {
                        await tx.account.update({
                            where: { id: accountIdMap.get(acct.id)! },
                            data: { parentId: accountIdMap.get(acct.parentId)! },
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 4. Duplicate Branches & Warehouses
                // ═══════════════════════════════════════════════════════════════
                const branchIdMap = new Map<string, string>();
                const warehouseIdMap = new Map<string, string>();

                const branches = await tx.branch.findMany({
                    where: { organizationId: id },
                    include: { warehouses: true },
                });

                for (const branch of branches) {
                    const newBranch = await tx.branch.create({
                        data: {
                            name: branch.name,
                            code: branch.code,
                            address: branch.address,
                            city: branch.city,
                            state: branch.state,
                            phone: branch.phone,
                            isActive: branch.isActive,
                            organizationId: N,
                        },
                    });
                    branchIdMap.set(branch.id, newBranch.id);

                    for (const wh of branch.warehouses) {
                        const newWh = await tx.warehouse.create({
                            data: {
                                name: wh.name,
                                code: wh.code,
                                branchId: newBranch.id,
                                address: wh.address,
                                isActive: wh.isActive,
                                isDefault: wh.isDefault,
                                organizationId: N,
                            },
                        });
                        warehouseIdMap.set(wh.id, newWh.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 5. Duplicate Cash & Bank Accounts
                // ═══════════════════════════════════════════════════════════════
                const cashBankIdMap = new Map<string, string>();
                const cashBankAccounts = await tx.cashBankAccount.findMany({
                    where: { organizationId: id },
                });
                for (const cba of cashBankAccounts) {
                    const newAccountId = accountIdMap.get(cba.accountId);
                    if (newAccountId) {
                        const newCba = await tx.cashBankAccount.create({
                            data: {
                                name: cba.name,
                                accountId: newAccountId,
                                accountSubType: cba.accountSubType,
                                bankName: cba.bankName,
                                accountNumber: cba.accountNumber,
                                balance: includeTransactions ? cba.balance : 0,
                                isDefault: cba.isDefault,
                                isActive: cba.isActive,
                                organizationId: N,
                                branchId: cba.branchId ? branchIdMap.get(cba.branchId) || null : null,
                            },
                        });
                        cashBankIdMap.set(cba.id, newCba.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 6. Duplicate Product Categories
                // ═══════════════════════════════════════════════════════════════
                const categories = await tx.productCategory.findMany({
                    where: { organizationId: id },
                });
                const categoryIdMap = new Map<string, string>();
                for (const cat of categories) {
                    const newCat = await tx.productCategory.create({
                        data: {
                            name: cat.name,
                            slug: cat.slug,
                            color: cat.color,
                            sortOrder: cat.sortOrder,
                            isActive: cat.isActive,
                            organizationId: N,
                        },
                    });
                    categoryIdMap.set(cat.id, newCat.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 7. Duplicate Units
                // ═══════════════════════════════════════════════════════════════
                const units = await tx.unit.findMany({
                    where: { organizationId: id },
                });
                const unitIdMap = new Map<string, string>();
                for (const unit of units) {
                    const newUnit = await tx.unit.create({
                        data: {
                            code: unit.code,
                            name: unit.name,
                            isActive: unit.isActive,
                            organizationId: N,
                        },
                    });
                    unitIdMap.set(unit.id, newUnit.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 8. Duplicate Unit Conversions
                // ═══════════════════════════════════════════════════════════════
                const unitConversions = await tx.unitConversion.findMany({
                    where: { organizationId: id },
                });
                for (const uc of unitConversions) {
                    const newFromId = unitIdMap.get(uc.fromUnitId);
                    const newToId = unitIdMap.get(uc.toUnitId);
                    if (newFromId && newToId) {
                        await tx.unitConversion.create({
                            data: {
                                organizationId: N,
                                fromUnitId: newFromId,
                                toUnitId: newToId,
                                conversionFactor: uc.conversionFactor,
                            },
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 9. Duplicate Products
                // ═══════════════════════════════════════════════════════════════
                const products = await tx.product.findMany({
                    where: { organizationId: id },
                });
                const productIdMap = new Map<string, string>();
                for (const prod of products) {
                    const newProd = await tx.product.create({
                        data: {
                            name: prod.name,
                            arabicName: prod.arabicName,
                            description: prod.description,
                            price: prod.price,
                            cost: prod.cost,
                            unitCode: prod.unitCode,
                            unitId: prod.unitId ? unitIdMap.get(prod.unitId) || null : null,
                            sku: prod.sku,
                            barcode: prod.barcode,
                            hsnCode: prod.hsnCode,
                            gstRate: prod.gstRate,
                            isService: prod.isService,
                            isImeiTracked: prod.isImeiTracked,
                            isBundle: prod.isBundle,
                            weighMachineCode: prod.weighMachineCode,
                            isActive: prod.isActive,
                            organizationId: N,
                            categoryId: prod.categoryId
                                ? categoryIdMap.get(prod.categoryId) || null
                                : null,
                        },
                    });
                    productIdMap.set(prod.id, newProd.id);
                }

                // Duplicate ProductBundleItems
                const bundleItems = await tx.productBundleItem.findMany({
                    where: { organizationId: id },
                });
                for (const bi of bundleItems) {
                    const newBundleId = productIdMap.get(bi.bundleProductId);
                    const newComponentId = productIdMap.get(bi.componentProductId);
                    if (newBundleId && newComponentId) {
                        await tx.productBundleItem.create({
                            data: {
                                bundleProductId: newBundleId,
                                componentProductId: newComponentId,
                                quantity: bi.quantity,
                                organizationId: N,
                            },
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // If NOT including transactional data, we're done
                // ═══════════════════════════════════════════════════════════════
                if (!includeTransactions) {
                    return org;
                }

                // Helper to remap nullable FK
                const remap = (map: Map<string, string>, oldId: string | null | undefined) =>
                    oldId ? map.get(oldId) || null : null;

                // ═══════════════════════════════════════════════════════════════
                // 10. Duplicate Customers
                // ═══════════════════════════════════════════════════════════════
                const customers = await tx.customer.findMany({
                    where: { organizationId: id },
                });
                const customerIdMap = new Map<string, string>();
                for (const c of customers) {
                    const nc = await tx.customer.create({
                        data: {
                            name: c.name,
                            email: c.email,
                            phone: c.phone,
                            address: c.address,
                            city: c.city,
                            state: c.state,
                            zipCode: c.zipCode,
                            country: c.country,
                            gstin: c.gstin,
                            gstStateCode: c.gstStateCode,
                            arabicName: c.arabicName,
                            vatNumber: c.vatNumber,
                            ccNo: c.ccNo,
                            buildingNo: c.buildingNo,
                            addNo: c.addNo,
                            district: c.district,
                            balance: c.balance,
                            notes: c.notes,
                            isActive: c.isActive,
                            organizationId: N,
                        },
                    });
                    customerIdMap.set(c.id, nc.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 11. Duplicate Suppliers
                // ═══════════════════════════════════════════════════════════════
                const suppliers = await tx.supplier.findMany({
                    where: { organizationId: id },
                });
                const supplierIdMap = new Map<string, string>();
                for (const s of suppliers) {
                    const ns = await tx.supplier.create({
                        data: {
                            name: s.name,
                            email: s.email,
                            phone: s.phone,
                            address: s.address,
                            city: s.city,
                            state: s.state,
                            zipCode: s.zipCode,
                            country: s.country,
                            gstin: s.gstin,
                            gstStateCode: s.gstStateCode,
                            arabicName: s.arabicName,
                            vatNumber: s.vatNumber,
                            balance: s.balance,
                            notes: s.notes,
                            isActive: s.isActive,
                            organizationId: N,
                        },
                    });
                    supplierIdMap.set(s.id, ns.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 12. Duplicate Journal Entries & Lines
                // ═══════════════════════════════════════════════════════════════
                const journalEntries = await tx.journalEntry.findMany({
                    where: { organizationId: id },
                    include: { lines: true },
                });
                const journalEntryIdMap = new Map<string, string>();
                for (const je of journalEntries) {
                    const nje = await tx.journalEntry.create({
                        data: {
                            journalNumber: je.journalNumber,
                            date: je.date,
                            description: je.description,
                            status: je.status,
                            sourceType: je.sourceType,
                            sourceId: null, // Can't remap generic sourceId
                            branchId: remap(branchIdMap, je.branchId),
                            organizationId: N,
                        },
                    });
                    journalEntryIdMap.set(je.id, nje.id);

                    if (je.lines.length > 0) {
                        await tx.journalEntryLine.createMany({
                            data: je.lines.map((l) => ({
                                journalEntryId: nje.id,
                                accountId: accountIdMap.get(l.accountId) || l.accountId,
                                description: l.description,
                                debit: l.debit,
                                credit: l.credit,
                                organizationId: N,
                            })),
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 13. Duplicate Invoices & Items
                // ═══════════════════════════════════════════════════════════════
                const invoices = await tx.invoice.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                const invoiceIdMap = new Map<string, string>();
                const invoiceItemIdMap = new Map<string, string>();
                for (const inv of invoices) {
                    const newCustId = customerIdMap.get(inv.customerId);
                    if (!newCustId) continue; // skip if customer missing

                    const ni = await tx.invoice.create({
                        data: {
                            invoiceNumber: inv.invoiceNumber,
                            customerId: newCustId,
                            createdById: null, // Users are not copied
                            organizationId: N,
                            issueDate: inv.issueDate,
                            dueDate: inv.dueDate,
                            subtotal: inv.subtotal,
                            total: inv.total,
                            amountPaid: inv.amountPaid,
                            balanceDue: inv.balanceDue,
                            roundOffAmount: inv.roundOffAmount,
                            applyRoundOff: inv.applyRoundOff,
                            totalCgst: inv.totalCgst,
                            totalSgst: inv.totalSgst,
                            totalIgst: inv.totalIgst,
                            placeOfSupply: inv.placeOfSupply,
                            isInterState: inv.isInterState,
                            eInvoiceIrn: null,
                            eInvoiceAckNo: null,
                            eInvoiceAckDate: null,
                            eInvoiceSignedQr: null,
                            eInvoiceStatus: null,
                            saudiInvoiceType: inv.saudiInvoiceType,
                            totalVat: inv.totalVat,
                            qrCodeData: inv.qrCodeData,
                            invoiceUuid: inv.invoiceUuid,
                            invoiceCounterValue: inv.invoiceCounterValue,
                            previousInvoiceHash: null,
                            invoiceHash: null,
                            sentAt: inv.sentAt,
                            notes: inv.notes,
                            terms: inv.terms,
                            sourceType: inv.sourceType,
                            posSessionId: null,
                            branchId: remap(branchIdMap, inv.branchId),
                            warehouseId: remap(warehouseIdMap, inv.warehouseId),
                            paymentType: inv.paymentType,
                            isTaxInclusive: inv.isTaxInclusive,
                        },
                    });
                    invoiceIdMap.set(inv.id, ni.id);

                    for (const item of inv.items) {
                        const nii = await tx.invoiceItem.create({
                            data: {
                                invoiceId: ni.id,
                                organizationId: N,
                                productId: remap(productIdMap, item.productId),
                                unitId: remap(unitIdMap, item.unitId),
                                conversionFactor: item.conversionFactor,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discount: item.discount,
                                total: item.total,
                                hsnCode: item.hsnCode,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                vatRate: item.vatRate,
                                vatAmount: item.vatAmount,
                                vatCategory: item.vatCategory,
                                costOfGoodsSold: item.costOfGoodsSold,
                            },
                        });
                        invoiceItemIdMap.set(item.id, nii.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 14. Duplicate Purchase Invoices & Items
                // ═══════════════════════════════════════════════════════════════
                const purchaseInvoices = await tx.purchaseInvoice.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                const purchaseInvoiceIdMap = new Map<string, string>();
                const purchaseInvoiceItemIdMap = new Map<string, string>();
                for (const pi of purchaseInvoices) {
                    const newSuppId = supplierIdMap.get(pi.supplierId);
                    if (!newSuppId) continue;

                    const npi = await tx.purchaseInvoice.create({
                        data: {
                            purchaseInvoiceNumber: pi.purchaseInvoiceNumber,
                            supplierId: newSuppId,
                            organizationId: N,
                            invoiceDate: pi.invoiceDate,
                            dueDate: pi.dueDate,
                            supplierInvoiceRef: pi.supplierInvoiceRef,
                            status: pi.status,
                            subtotal: pi.subtotal,
                            total: pi.total,
                            amountPaid: pi.amountPaid,
                            balanceDue: pi.balanceDue,
                            roundOffAmount: pi.roundOffAmount,
                            applyRoundOff: pi.applyRoundOff,
                            totalCgst: pi.totalCgst,
                            totalSgst: pi.totalSgst,
                            totalIgst: pi.totalIgst,
                            placeOfSupply: pi.placeOfSupply,
                            isInterState: pi.isInterState,
                            totalVat: pi.totalVat,
                            invoiceUuid: pi.invoiceUuid,
                            invoiceCounterValue: pi.invoiceCounterValue,
                            previousInvoiceHash: null,
                            invoiceHash: null,
                            notes: pi.notes,
                            isTaxInclusive: pi.isTaxInclusive,
                            branchId: remap(branchIdMap, pi.branchId),
                            warehouseId: remap(warehouseIdMap, pi.warehouseId),
                        },
                    });
                    purchaseInvoiceIdMap.set(pi.id, npi.id);

                    for (const item of pi.items) {
                        const npii = await tx.purchaseInvoiceItem.create({
                            data: {
                                purchaseInvoiceId: npi.id,
                                organizationId: N,
                                productId: productIdMap.get(item.productId) || item.productId,
                                unitId: remap(unitIdMap, item.unitId),
                                conversionFactor: item.conversionFactor,
                                description: item.description,
                                quantity: item.quantity,
                                unitCost: item.unitCost,
                                discount: item.discount,
                                total: item.total,
                                hsnCode: item.hsnCode,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                vatRate: item.vatRate,
                                vatAmount: item.vatAmount,
                                vatCategory: item.vatCategory,
                            },
                        });
                        purchaseInvoiceItemIdMap.set(item.id, npii.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 15. Duplicate Quotations & Items
                // ═══════════════════════════════════════════════════════════════
                const quotations = await tx.quotation.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                for (const q of quotations) {
                    const newCustId = customerIdMap.get(q.customerId);
                    if (!newCustId) continue;

                    const nq = await tx.quotation.create({
                        data: {
                            quotationNumber: q.quotationNumber,
                            customerId: newCustId,
                            organizationId: N,
                            issueDate: q.issueDate,
                            validUntil: q.validUntil,
                            status: q.status,
                            subtotal: q.subtotal,
                            total: q.total,
                            totalCgst: q.totalCgst,
                            totalSgst: q.totalSgst,
                            totalIgst: q.totalIgst,
                            placeOfSupply: q.placeOfSupply,
                            isInterState: q.isInterState,
                            totalVat: q.totalVat,
                            notes: q.notes,
                            terms: q.terms,
                            isTaxInclusive: q.isTaxInclusive,
                            convertedInvoiceId: remap(invoiceIdMap, q.convertedInvoiceId),
                            convertedAt: q.convertedAt,
                            branchId: remap(branchIdMap, q.branchId),
                            warehouseId: remap(warehouseIdMap, q.warehouseId),
                        },
                    });

                    if (q.items.length > 0) {
                        await tx.quotationItem.createMany({
                            data: q.items.map((item) => ({
                                quotationId: nq.id,
                                organizationId: N,
                                productId: remap(productIdMap, item.productId),
                                unitId: remap(unitIdMap, item.unitId),
                                conversionFactor: item.conversionFactor,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discount: item.discount,
                                total: item.total,
                                hsnCode: item.hsnCode,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                            })),
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 16. Duplicate Opening Stock
                // ═══════════════════════════════════════════════════════════════
                const openingStocks = await tx.openingStock.findMany({
                    where: { organizationId: id },
                });
                const openingStockIdMap = new Map<string, string>();
                for (const os of openingStocks) {
                    const nos = await tx.openingStock.create({
                        data: {
                            productId: productIdMap.get(os.productId) || os.productId,
                            organizationId: N,
                            quantity: os.quantity,
                            unitCost: os.unitCost,
                            stockDate: os.stockDate,
                            notes: os.notes,
                            warehouseId: remap(warehouseIdMap, os.warehouseId),
                        },
                    });
                    openingStockIdMap.set(os.id, nos.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 17. Duplicate Credit Notes & Items
                // ═══════════════════════════════════════════════════════════════
                const creditNotes = await tx.creditNote.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                const creditNoteIdMap = new Map<string, string>();
                const creditNoteItemIdMap = new Map<string, string>();
                for (const cn of creditNotes) {
                    const newCustId = customerIdMap.get(cn.customerId);
                    if (!newCustId) continue;

                    const ncn = await tx.creditNote.create({
                        data: {
                            creditNoteNumber: cn.creditNoteNumber,
                            organizationId: N,
                            invoiceId: remap(invoiceIdMap, cn.invoiceId),
                            customerId: newCustId,
                            createdById: null,
                            issueDate: cn.issueDate,
                            subtotal: cn.subtotal,
                            total: cn.total,
                            totalCgst: cn.totalCgst,
                            totalSgst: cn.totalSgst,
                            totalIgst: cn.totalIgst,
                            placeOfSupply: cn.placeOfSupply,
                            isInterState: cn.isInterState,
                            totalVat: cn.totalVat,
                            qrCodeData: cn.qrCodeData,
                            invoiceUuid: cn.invoiceUuid,
                            invoiceCounterValue: cn.invoiceCounterValue,
                            previousInvoiceHash: null,
                            invoiceHash: null,
                            appliedToBalance: cn.appliedToBalance,
                            reason: cn.reason,
                            notes: cn.notes,
                            branchId: remap(branchIdMap, cn.branchId),
                            warehouseId: remap(warehouseIdMap, cn.warehouseId),
                        },
                    });
                    creditNoteIdMap.set(cn.id, ncn.id);

                    for (const item of cn.items) {
                        const ncni = await tx.creditNoteItem.create({
                            data: {
                                creditNoteId: ncn.id,
                                organizationId: N,
                                invoiceItemId: remap(invoiceItemIdMap, item.invoiceItemId),
                                productId: remap(productIdMap, item.productId),
                                unitId: remap(unitIdMap, item.unitId),
                                conversionFactor: item.conversionFactor,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                discount: item.discount,
                                total: item.total,
                                hsnCode: item.hsnCode,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                vatRate: item.vatRate,
                                vatAmount: item.vatAmount,
                                vatCategory: item.vatCategory,
                                originalCOGS: item.originalCOGS,
                            },
                        });
                        creditNoteItemIdMap.set(item.id, ncni.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 18. Duplicate Debit Notes & Items
                // ═══════════════════════════════════════════════════════════════
                const debitNotes = await tx.debitNote.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                const debitNoteItemIdMap = new Map<string, string>();
                for (const dn of debitNotes) {
                    const newSuppId = supplierIdMap.get(dn.supplierId);
                    if (!newSuppId) continue;

                    const ndn = await tx.debitNote.create({
                        data: {
                            debitNoteNumber: dn.debitNoteNumber,
                            organizationId: N,
                            purchaseInvoiceId: remap(purchaseInvoiceIdMap, dn.purchaseInvoiceId),
                            supplierId: newSuppId,
                            issueDate: dn.issueDate,
                            subtotal: dn.subtotal,
                            total: dn.total,
                            roundOffAmount: dn.roundOffAmount,
                            applyRoundOff: dn.applyRoundOff,
                            totalCgst: dn.totalCgst,
                            totalSgst: dn.totalSgst,
                            totalIgst: dn.totalIgst,
                            placeOfSupply: dn.placeOfSupply,
                            isInterState: dn.isInterState,
                            totalVat: dn.totalVat,
                            invoiceUuid: dn.invoiceUuid,
                            invoiceCounterValue: dn.invoiceCounterValue,
                            previousInvoiceHash: null,
                            invoiceHash: null,
                            appliedToBalance: dn.appliedToBalance,
                            reason: dn.reason,
                            notes: dn.notes,
                            branchId: remap(branchIdMap, dn.branchId),
                            warehouseId: remap(warehouseIdMap, dn.warehouseId),
                        },
                    });

                    for (const item of dn.items) {
                        const ndni = await tx.debitNoteItem.create({
                            data: {
                                debitNoteId: ndn.id,
                                organizationId: N,
                                purchaseInvoiceItemId: remap(purchaseInvoiceItemIdMap, item.purchaseInvoiceItemId),
                                productId: productIdMap.get(item.productId) || item.productId,
                                unitId: remap(unitIdMap, item.unitId),
                                conversionFactor: item.conversionFactor,
                                description: item.description,
                                quantity: item.quantity,
                                unitCost: item.unitCost,
                                discount: item.discount,
                                total: item.total,
                                hsnCode: item.hsnCode,
                                gstRate: item.gstRate,
                                cgstRate: item.cgstRate,
                                sgstRate: item.sgstRate,
                                igstRate: item.igstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                vatRate: item.vatRate,
                                vatAmount: item.vatAmount,
                                vatCategory: item.vatCategory,
                            },
                        });
                        debitNoteItemIdMap.set(item.id, ndni.id);
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 19. Duplicate Stock Lots
                // ═══════════════════════════════════════════════════════════════
                const stockLots = await tx.stockLot.findMany({
                    where: { organizationId: id },
                });
                const stockLotIdMap = new Map<string, string>();
                for (const sl of stockLots) {
                    const nsl = await tx.stockLot.create({
                        data: {
                            productId: productIdMap.get(sl.productId) || sl.productId,
                            organizationId: N,
                            sourceType: sl.sourceType,
                            purchaseInvoiceItemId: remap(purchaseInvoiceItemIdMap, sl.purchaseInvoiceItemId),
                            purchaseInvoiceId: remap(purchaseInvoiceIdMap, sl.purchaseInvoiceId),
                            openingStockId: remap(openingStockIdMap, sl.openingStockId),
                            creditNoteItemId: remap(creditNoteItemIdMap, sl.creditNoteItemId),
                            stockTransferId: null, // Stock transfers handled separately
                            warehouseId: remap(warehouseIdMap, sl.warehouseId),
                            lotDate: sl.lotDate,
                            unitCost: sl.unitCost,
                            initialQuantity: sl.initialQuantity,
                            remainingQuantity: sl.remainingQuantity,
                        },
                    });
                    stockLotIdMap.set(sl.id, nsl.id);
                }

                // ═══════════════════════════════════════════════════════════════
                // 20. Duplicate Stock Lot Consumptions
                // ═══════════════════════════════════════════════════════════════
                const stockLotConsumptions = await tx.stockLotConsumption.findMany({
                    where: { organizationId: id },
                });
                for (const slc of stockLotConsumptions) {
                    const newLotId = stockLotIdMap.get(slc.stockLotId);
                    if (!newLotId) continue;

                    await tx.stockLotConsumption.create({
                        data: {
                            stockLotId: newLotId,
                            organizationId: N,
                            invoiceItemId: remap(invoiceItemIdMap, slc.invoiceItemId),
                            stockTransferItemId: null,
                            quantityConsumed: slc.quantityConsumed,
                            unitCost: slc.unitCost,
                            totalCost: slc.totalCost,
                        },
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // 21. Duplicate Debit Note Lot Consumptions
                // ═══════════════════════════════════════════════════════════════
                const debitNoteLotConsumptions = await tx.debitNoteLotConsumption.findMany({
                    where: { organizationId: id },
                });
                for (const dnlc of debitNoteLotConsumptions) {
                    const newLotId = stockLotIdMap.get(dnlc.stockLotId);
                    const newDniId = debitNoteItemIdMap.get(dnlc.debitNoteItemId);
                    if (!newLotId || !newDniId) continue;

                    await tx.debitNoteLotConsumption.create({
                        data: {
                            debitNoteItemId: newDniId,
                            organizationId: N,
                            stockLotId: newLotId,
                            quantityReturned: dnlc.quantityReturned,
                            unitCost: dnlc.unitCost,
                            totalCost: dnlc.totalCost,
                        },
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // 22. Duplicate Payments (Customer)
                // ═══════════════════════════════════════════════════════════════
                const payments = await tx.payment.findMany({
                    where: { organizationId: id },
                    include: { allocations: true },
                });
                const paymentIdMap = new Map<string, string>();
                for (const p of payments) {
                    const newCustId = customerIdMap.get(p.customerId);
                    if (!newCustId) continue;

                    const np = await tx.payment.create({
                        data: {
                            paymentNumber: p.paymentNumber,
                            organizationId: N,
                            customerId: newCustId,
                            invoiceId: remap(invoiceIdMap, p.invoiceId),
                            amount: p.amount,
                            discountReceived: p.discountReceived,
                            paymentDate: p.paymentDate,
                            paymentMethod: p.paymentMethod,
                            reference: p.reference,
                            notes: p.notes,
                            adjustmentAccountId: remap(accountIdMap, p.adjustmentAccountId),
                            branchId: remap(branchIdMap, p.branchId),
                        },
                    });
                    paymentIdMap.set(p.id, np.id);

                    // Payment allocations
                    for (const alloc of p.allocations) {
                        const newInvId = invoiceIdMap.get(alloc.invoiceId);
                        if (!newInvId) continue;

                        await tx.paymentAllocation.create({
                            data: {
                                paymentId: np.id,
                                invoiceId: newInvId,
                                organizationId: N,
                                amount: alloc.amount,
                            },
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 23. Duplicate Supplier Payments
                // ═══════════════════════════════════════════════════════════════
                const supplierPayments = await tx.supplierPayment.findMany({
                    where: { organizationId: id },
                    include: { allocations: true },
                });
                for (const sp of supplierPayments) {
                    const newSuppId = supplierIdMap.get(sp.supplierId);
                    if (!newSuppId) continue;

                    const nsp = await tx.supplierPayment.create({
                        data: {
                            paymentNumber: sp.paymentNumber,
                            organizationId: N,
                            supplierId: newSuppId,
                            purchaseInvoiceId: remap(purchaseInvoiceIdMap, sp.purchaseInvoiceId),
                            amount: sp.amount,
                            discountGiven: sp.discountGiven,
                            paymentDate: sp.paymentDate,
                            paymentMethod: sp.paymentMethod,
                            reference: sp.reference,
                            notes: sp.notes,
                            adjustmentAccountId: remap(accountIdMap, sp.adjustmentAccountId),
                            branchId: remap(branchIdMap, sp.branchId),
                        },
                    });

                    for (const alloc of sp.allocations) {
                        const newPiId = purchaseInvoiceIdMap.get(alloc.purchaseInvoiceId);
                        if (!newPiId) continue;

                        await tx.supplierPaymentAllocation.create({
                            data: {
                                supplierPaymentId: nsp.id,
                                purchaseInvoiceId: newPiId,
                                organizationId: N,
                                amount: alloc.amount,
                            },
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 24. Duplicate Expenses & Items
                // ═══════════════════════════════════════════════════════════════
                const expenses = await tx.expense.findMany({
                    where: { organizationId: id },
                    include: { items: true },
                });
                for (const exp of expenses) {
                    const ne = await tx.expense.create({
                        data: {
                            expenseNumber: exp.expenseNumber,
                            status: exp.status,
                            supplierId: remap(supplierIdMap, exp.supplierId),
                            cashBankAccountId: remap(cashBankIdMap, exp.cashBankAccountId),
                            expenseDate: exp.expenseDate,
                            description: exp.description,
                            subtotal: exp.subtotal,
                            total: exp.total,
                            totalCgst: exp.totalCgst,
                            totalSgst: exp.totalSgst,
                            totalIgst: exp.totalIgst,
                            placeOfSupply: exp.placeOfSupply,
                            isInterState: exp.isInterState,
                            totalVat: exp.totalVat,
                            notes: exp.notes,
                            journalEntryId: remap(journalEntryIdMap, exp.journalEntryId),
                            branchId: remap(branchIdMap, exp.branchId),
                            organizationId: N,
                        },
                    });

                    if (exp.items.length > 0) {
                        await tx.expenseItem.createMany({
                            data: exp.items.map((item) => ({
                                expenseId: ne.id,
                                accountId: accountIdMap.get(item.accountId) || item.accountId,
                                description: item.description,
                                amount: item.amount,
                                gstRate: item.gstRate,
                                cgstAmount: item.cgstAmount,
                                sgstAmount: item.sgstAmount,
                                igstAmount: item.igstAmount,
                                organizationId: N,
                            })),
                        });
                    }
                }

                // ═══════════════════════════════════════════════════════════════
                // 25. Duplicate Cash/Bank Transactions
                // ═══════════════════════════════════════════════════════════════
                const cashBankTxns = await tx.cashBankTransaction.findMany({
                    where: { organizationId: id },
                });
                if (cashBankTxns.length > 0) {
                    await tx.cashBankTransaction.createMany({
                        data: cashBankTxns
                            .filter((t) => cashBankIdMap.has(t.cashBankAccountId))
                            .map((t) => ({
                                cashBankAccountId: cashBankIdMap.get(t.cashBankAccountId)!,
                                transactionType: t.transactionType,
                                amount: t.amount,
                                runningBalance: t.runningBalance,
                                description: t.description,
                                referenceType: t.referenceType,
                                referenceId: null, // Can't reliably remap generic referenceId
                                transactionDate: t.transactionDate,
                                organizationId: N,
                            })),
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // 26. Duplicate Customer Transactions
                // ═══════════════════════════════════════════════════════════════
                const customerTxns = await tx.customerTransaction.findMany({
                    where: { organizationId: id },
                });
                if (customerTxns.length > 0) {
                    await tx.customerTransaction.createMany({
                        data: customerTxns
                            .filter((ct) => customerIdMap.has(ct.customerId))
                            .map((ct) => ({
                                customerId: customerIdMap.get(ct.customerId)!,
                                organizationId: N,
                                transactionType: ct.transactionType,
                                transactionDate: ct.transactionDate,
                                amount: ct.amount,
                                description: ct.description,
                                invoiceId: remap(invoiceIdMap, ct.invoiceId),
                                paymentId: remap(paymentIdMap, ct.paymentId),
                                creditNoteId: remap(creditNoteIdMap, ct.creditNoteId),
                                runningBalance: ct.runningBalance,
                            })),
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // 27. Duplicate Supplier Transactions
                // ═══════════════════════════════════════════════════════════════
                const supplierTxns = await tx.supplierTransaction.findMany({
                    where: { organizationId: id },
                });
                if (supplierTxns.length > 0) {
                    await tx.supplierTransaction.createMany({
                        data: supplierTxns
                            .filter((st) => supplierIdMap.has(st.supplierId))
                            .map((st) => ({
                                supplierId: supplierIdMap.get(st.supplierId)!,
                                organizationId: N,
                                transactionType: st.transactionType,
                                transactionDate: st.transactionDate,
                                amount: st.amount,
                                description: st.description,
                                purchaseInvoiceId: remap(purchaseInvoiceIdMap, st.purchaseInvoiceId),
                                supplierPaymentId: null, // Generic remap not possible
                                debitNoteId: null,
                                runningBalance: st.runningBalance,
                            })),
                    });
                }

                return org;
            },
            {
                maxWait: 30000,
                timeout: 300000, // 5-minute timeout for large orgs with transactions
            }
        );

        return NextResponse.json(newOrg, { status: 201 });
    } catch (error) {
        console.error("Failed to duplicate organization:", error);
        return NextResponse.json(
            { error: "Failed to duplicate organization" },
            { status: 500 }
        );
    }
}
