import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { fetchMyInternshipId } from '@/lib/dataService';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/FeedbackStates';
import { useI18n } from '@/i18n';

/** /internship/mine → the student's active (or latest) internship. */
export default function MyInternshipRedirect() {
  const { t } = useI18n();
  const [state, setState] = useState<{ id?: string | null; error?: string }>({});

  const load = () => {
    setState({});
    fetchMyInternshipId()
      .then((id) => setState({ id }))
      .catch((e) => setState({ error: e.message }));
  };
  useEffect(load, []);

  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (state.id === undefined) return <LoadingState />;
  if (state.id === null) {
    return (
      <EmptyState
        icon={<Briefcase className="h-6 w-6" />}
        title={t('Amaliyot biriktirilmagan')}
        description={t("Sizga hali amaliyot biriktirilmagan. Amaliyot bo'limiga murojaat qiling.")}
      />
    );
  }
  return <Navigate to={`/internship/${state.id}`} replace />;
}
