export type Travel = {
  id: string;
  name: string;
  coverUrl: string | null;
  /** Un voyage a une destination, des dates et une carte ; sinon projet classique. */
  isVoyage: boolean;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
};

/** Champs éditables du formulaire projet (identiques en création et en édition). */
export type TravelDetailsInput = {
  name: string;
  /** URL déjà uploadée de la photo de couverture (null si aucune). */
  coverUrl: string | null;
  isVoyage: boolean;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type CreateTravelInput = TravelDetailsInput;

export type UpdateTravelInput = TravelDetailsInput & {
  id: string;
};
