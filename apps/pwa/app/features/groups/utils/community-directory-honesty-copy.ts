import type { CommunityDirectoryMaterializationHonesty } from "../services/community-directory-materialization-policy";

export function resolveCommunityDirectoryHonestySummary(
    honesty: CommunityDirectoryMaterializationHonesty,
    t: (key: string) => string,
): string {
    return t(`groups.directoryHonesty.${honesty.copyVariant}.summary`);
}

export function resolveCommunityDirectoryHonestyDetail(
    honesty: CommunityDirectoryMaterializationHonesty,
    t: (key: string) => string,
): string {
    return t(`groups.directoryHonesty.${honesty.copyVariant}.detail`);
}
