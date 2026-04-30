// Card model — mirrors docs/spec/00-core.md.
// Server-derived fields (counts, denormalized, RLS-controlled visibility) are
// included as plain fields here since this UI shell consumes mock data only.

export type BorderKind =
  | "default"
  | "ad"
  | "forwarded"
  | "system"
  | "direct_contact"
  | "friend_of_friend"
  | "merchant";

export type ImageOrigin = "camera" | "gallery" | "lidar_ai";

export type CaptionMode = "below" | "overlay";

export interface OverlayLayout {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  fontSize: number; // px at 1080w reference
  color: string;
  fontWeight: number;
}

export interface SensorReadings {
  geoPoint?: { lat: number; lng: number };
  elevationM?: number;
  compassHeadingDeg?: number;
  trailLengthM?: number;
  ambientTempC?: number;
  ambientTempSource?: "sensor" | "weather_api";
}

export interface Card {
  id: string;
  authorId: string;
  authorDisplayName: string;
  createdAt: string; // ISO
  imageUrl: string;
  imageOrigin: ImageOrigin;
  flairTemplateId?: string;
  captionText?: string;
  captionMode: CaptionMode;
  overlayLayout?: OverlayLayout;
  tags: string[];
  borderKind: BorderKind;
  forwardedFromUserId?: string;
  forwardedFromDisplayName?: string;
  sensors?: SensorReadings;
  counts: {
    bookmark: number;
    firewood: number;
    match: number;
    lol: number;
    forward: number;
  };
}

export interface MockUser {
  id: string;
  displayName: string;
}
