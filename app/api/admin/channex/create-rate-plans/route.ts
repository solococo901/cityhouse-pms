import { NextResponse } from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

/* ======================================================
   TYPES
====================================================== */

type ChannexRoomType = {
    id?: string;

    attributes?: {
        id?: string;

        title?: string;

        property_id?: string;

        default_occupancy?: number;
    };
};

type ChannexRatePlan = {
    id?: string;

    attributes?: {
        id?: string;

        title?: string;

        property_id?: string;

        room_type_id?: string;
    };
};

type RoomSelection = {
    roomTypeId: string;

    channexRoomTypeId: string;
};

/* ======================================================
   HELPERS
====================================================== */

function getChannexError(
    result: any,
    fallback: string
) {
    const errors =
        result?.errors;

    if (!errors) {
        return fallback;
    }

    if (
        typeof errors ===
        "string"
    ) {
        return errors;
    }

    if (
        errors?.title
    ) {
        const details =
            errors?.details;

        if (
            details &&
            typeof details ===
            "object"
        ) {
            const messages =
                Object.entries(
                    details
                )
                    .map(
                        ([
                            key,
                            value,
                        ]) =>
                            `${key}: ${Array.isArray(
                                value
                            )
                                ? value.join(
                                    ", "
                                )
                                : String(
                                    value
                                )
                            }`
                    )
                    .join("; ");

            if (messages) {
                return `${errors.title} — ${messages}`;
            }
        }

        return errors.title;
    }

    return fallback;
}

/* ======================================================
   POST
====================================================== */

export async function POST(
    request: Request
) {
    try {
        const supabase =
            await createClient();

        /* ==================================================
           AUTH
        ================================================== */

        const {
            data: {
                user,
            },
            error: authError,
        } =
            await supabase.auth.getUser();

        if (
            authError ||
            !user
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unauthorized",
                },
                {
                    status: 401,
                }
            );
        }

        /* ==================================================
           BODY
        ================================================== */

        const body =
            await request.json();

        const propertyId =
            body.propertyId as
            | string
            | undefined;

        const roomSelections =
            (
                Array.isArray(
                    body.roomSelections
                )
                    ? body.roomSelections
                    : []
            ) as RoomSelection[];

        if (!propertyId) {
            return NextResponse.json(
                {
                    error:
                        "Thiếu propertyId.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            roomSelections.length ===
            0
        ) {
            return NextResponse.json(
                {
                    error:
                        "Chưa có Room Type mapping.",
                },
                {
                    status: 400,
                }
            );
        }

        /* ==================================================
           ADMIN PERMISSION
        ================================================== */

        const {
            data: canManage,
            error:
            permissionError,
        } =
            await supabase.rpc(
                "can_manage_property",
                {
                    target_property_id:
                        propertyId,
                }
            );

        if (
            permissionError ||
            !canManage
        ) {
            return NextResponse.json(
                {
                    error:
                        "Bạn không có quyền Admin trên property này.",
                },
                {
                    status: 403,
                }
            );
        }

        /* ==================================================
           CONNECTION
        ================================================== */

        const {
            data: connection,
            error:
            connectionError,
        } =
            await supabase
                .from(
                    "channel_connections"
                )
                .select(`
          id,
          channex_property_id,
          environment,
          active
        `)
                .eq(
                    "property_id",
                    propertyId
                )
                .eq(
                    "provider",
                    "channex"
                )
                .eq(
                    "active",
                    true
                )
                .maybeSingle();

        if (
            connectionError ||
            !connection
        ) {
            return NextResponse.json(
                {
                    error:
                        "Không tìm thấy Channex connection.",
                },
                {
                    status: 404,
                }
            );
        }

        if (
            !connection
                .channex_property_id
        ) {
            return NextResponse.json(
                {
                    error:
                        "Property chưa được map với Channex.",
                },
                {
                    status: 400,
                }
            );
        }

        /* ==================================================
           PMS DATA
        ================================================== */

        const [
            roomTypesResult,
            ratePlansResult,
        ] =
            await Promise.all([
                supabase
                    .from(
                        "room_types"
                    )
                    .select(`
            id,
            code,
            name
          `)
                    .eq(
                        "property_id",
                        propertyId
                    )
                    .eq(
                        "active",
                        true
                    ),

                supabase
                    .from(
                        "rate_plans"
                    )
                    .select(`
            id,
            code,
            name
          `)
                    .eq(
                        "property_id",
                        propertyId
                    )
                    .eq(
                        "active",
                        true
                    ),
            ]);

        if (
            roomTypesResult.error
        ) {
            return NextResponse.json(
                {
                    error:
                        roomTypesResult
                            .error
                            .message,
                },
                {
                    status: 500,
                }
            );
        }

        if (
            ratePlansResult.error
        ) {
            return NextResponse.json(
                {
                    error:
                        ratePlansResult
                            .error
                            .message,
                },
                {
                    status: 500,
                }
            );
        }

        const pmsRoomTypes =
            roomTypesResult.data ??
            [];

        const pmsRatePlans =
            ratePlansResult.data ??
            [];

        /* ==================================================
           VALIDATE PMS ROOM IDs
        ================================================== */

        const validRoomIds =
            new Set(
                pmsRoomTypes.map(
                    (
                        room
                    ) =>
                        room.id
                )
            );

        for (
            const mapping of
            roomSelections
        ) {
            if (
                !validRoomIds.has(
                    mapping.roomTypeId
                )
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Room Type PMS không hợp lệ.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                !mapping
                    .channexRoomTypeId
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Có Room Type chưa được map với Channex.",
                    },
                    {
                        status: 400,
                    }
                );
            }
        }

        /* ==================================================
           ENV
        ================================================== */

        const baseUrl =
            (
                process.env
                    .CHANNEX_BASE_URL ||
                "https://staging.channex.io"
            ).replace(
                /\/+$/,
                ""
            );

        const apiKey =
            process.env
                .CHANNEX_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    error:
                        "Server chưa cấu hình CHANNEX_API_KEY.",
                },
                {
                    status: 500,
                }
            );
        }

        const headers = {
            Accept:
                "application/json",

            "Content-Type":
                "application/json",

            "user-api-key":
                apiKey,
        };

        /* ==================================================
           LOAD CHANNEX ROOMS + EXISTING RATES
        ================================================== */

        const [
            roomResponse,
            rateResponse,
        ] =
            await Promise.all([
                fetch(
                    `${baseUrl}/api/v1/room_types/options`,
                    {
                        headers,

                        cache:
                            "no-store",
                    }
                ),

                fetch(
                    `${baseUrl}/api/v1/rate_plans/options?filter[property_id]=${encodeURIComponent(
                        connection
                            .channex_property_id
                    )}`,
                    {
                        headers,

                        cache:
                            "no-store",
                    }
                ),
            ]);

        if (
            !roomResponse.ok
        ) {
            return NextResponse.json(
                {
                    error:
                        `Không thể tải Channex Room Types (${roomResponse.status}).`,
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !rateResponse.ok
        ) {
            return NextResponse.json(
                {
                    error:
                        `Không thể tải Channex Rate Plans (${rateResponse.status}).`,
                },
                {
                    status: 400,
                }
            );
        }

        const roomResult =
            await roomResponse.json();

        const rateResult =
            await rateResponse.json();

        const channexRooms =
            (
                Array.isArray(
                    roomResult?.data
                )
                    ? roomResult.data
                    : []
            )
                .filter(
                    (
                        item:
                            ChannexRoomType
                    ) =>
                        item.attributes
                            ?.property_id ===
                        connection
                            .channex_property_id
                ) as
            ChannexRoomType[];

        const existingRates =
            (
                Array.isArray(
                    rateResult?.data
                )
                    ? rateResult.data
                    : []
            ) as
            ChannexRatePlan[];

        /* ==================================================
           RESULT
        ================================================== */

        const created: {
            roomTypeId: string;

            ratePlanId: string;

            channexRoomTypeId:
            string;

            channexRatePlanId:
            string;

            title: string;
        }[] = [];

        const reused: {
            roomTypeId: string;

            ratePlanId: string;

            channexRoomTypeId:
            string;

            channexRatePlanId:
            string;

            title: string;
        }[] = [];

        /* ==================================================
           CREATE RATE PLANS
    
           PMS:
           Deluxe + Standard
           Deluxe + Non Refundable
           Studio + Standard
           Studio + Non Refundable
    
           →
    
           CHANNEX:
           Demo Double - Standard Rate
           Demo Double - Non Refundable
           Demo Single - Standard Rate
           Demo Single - Non Refundable
        ================================================== */

        for (
            const selection of
            roomSelections
        ) {
            const pmsRoom =
                pmsRoomTypes.find(
                    (
                        item
                    ) =>
                        item.id ===
                        selection.roomTypeId
                );

            if (!pmsRoom) {
                continue;
            }

            const channexRoom =
                channexRooms.find(
                    (
                        item
                    ) =>
                        item.id ===
                        selection
                            .channexRoomTypeId
                );

            if (!channexRoom) {
                return NextResponse.json(
                    {
                        error:
                            `Không tìm thấy Channex Room Type cho ${pmsRoom.name}.`,
                    },
                    {
                        status: 400,
                    }
                );
            }

            const roomTitle =
                channexRoom
                    .attributes
                    ?.title ??
                pmsRoom.name;

            const occupancy =
                Math.max(
                    1,
                    Number(
                        channexRoom
                            .attributes
                            ?.default_occupancy ??
                        1
                    )
                );

            for (
                const pmsRate of
                pmsRatePlans
            ) {
                /*
                 * Channex yêu cầu title Rate Plan.
                 * Dùng room title + PMS rate name
                 * để đảm bảo mapping rõ ràng.
                 */

                const rateTitle =
                    `${roomTitle} - ${pmsRate.name}`
                        .slice(
                            0,
                            255
                        );

                /* ===============================================
                   IDEMPOTENT:
                   nếu đã tạo trước đó thì dùng lại.
                =============================================== */

                const existing =
                    existingRates.find(
                        (
                            item
                        ) =>
                            item.attributes
                                ?.room_type_id ===
                            selection
                                .channexRoomTypeId &&
                            item.attributes
                                ?.title ===
                            rateTitle
                    );

                if (
                    existing?.id
                ) {
                    reused.push({
                        roomTypeId:
                            pmsRoom.id,

                        ratePlanId:
                            pmsRate.id,

                        channexRoomTypeId:
                            selection
                                .channexRoomTypeId,

                        channexRatePlanId:
                            existing.id,

                        title:
                            rateTitle,
                    });

                    continue;
                }

                /* ===============================================
                   CREATE
                =============================================== */

                const createResponse =
                    await fetch(
                        `${baseUrl}/api/v1/rate_plans`,
                        {
                            method:
                                "POST",

                            headers,

                            body:
                                JSON.stringify({
                                    rate_plan: {
                                        title:
                                            rateTitle,

                                        property_id:
                                            connection
                                                .channex_property_id,

                                        room_type_id:
                                            selection
                                                .channexRoomTypeId,

                                        currency:
                                            process.env
                                                .PMS_CURRENCY ||
                                            "VND",

                                        options: [
                                            {
                                                occupancy,

                                                is_primary:
                                                    true,

                                                rate:
                                                    0,
                                            },
                                        ],

                                        sell_mode:
                                            "per_room",

                                        rate_mode:
                                            "manual",
                                    },
                                }),

                            cache:
                                "no-store",
                        }
                    );

                const rawText =
                    await createResponse.text();

                let createResult:
                    any = null;

                try {
                    createResult =
                        JSON.parse(
                            rawText
                        );
                } catch {
                    createResult =
                        null;
                }

                if (
                    !createResponse.ok
                ) {
                    const message =
                        getChannexError(
                            createResult,
                            `Không thể tạo ${rateTitle} (${createResponse.status}).`
                        );

                    return NextResponse.json(
                        {
                            error:
                                message,

                            room:
                                pmsRoom.name,

                            rate:
                                pmsRate.name,
                        },
                        {
                            status: 400,
                        }
                    );
                }

                const createdId =
                    createResult
                        ?.data
                        ?.id;

                if (!createdId) {
                    return NextResponse.json(
                        {
                            error:
                                `Channex đã tạo ${rateTitle} nhưng không trả về Rate Plan ID.`,
                        },
                        {
                            status: 500,
                        }
                    );
                }

                created.push({
                    roomTypeId:
                        pmsRoom.id,

                    ratePlanId:
                        pmsRate.id,

                    channexRoomTypeId:
                        selection
                            .channexRoomTypeId,

                    channexRatePlanId:
                        createdId,

                    title:
                        rateTitle,
                });

                /*
                 * Thêm vào local list để tránh
                 * duplicate trong cùng request.
                 */

                existingRates.push({
                    id:
                        createdId,

                    attributes: {
                        id:
                            createdId,

                        title:
                            rateTitle,

                        property_id:
                            connection
                                .channex_property_id,

                        room_type_id:
                            selection
                                .channexRoomTypeId,
                    },
                });
            }
        }

        /* ==================================================
           SUCCESS
        ================================================== */

        return NextResponse.json({
            success: true,

            createdCount:
                created.length,

            reusedCount:
                reused.length,

            mappings: [
                ...reused,
                ...created,
            ],
        });
    } catch (error) {
        console.error(
            "Create Channex Rate Plans:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Không thể tạo Rate Plans trên Channex.",
            },
            {
                status: 500,
            }
        );
    }
}