import { Link, Navigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import { useStudentRequest } from '../../../hooks/useClassRequests';
import StatusBadge from '../../../components/ui/StatusBadge';

export default function StudentRequestDetailsPage() {
  const { requestId } = useParams();
  const { request, isLoading } = useStudentRequest(requestId || '');

  if (!requestId) {
    return <Navigate to="/app/student/requests" replace />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Class Request Details" description="Review full lesson details, files, tutor info, and current status." />

      <SectionCard>
        {isLoading ? <LoadingState message="Loading class details..." /> : request ? (
          <div className="space-y-4 text-sm text-zinc-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">{request.topic || 'Mathematics Request'}</h2>
              <StatusBadge status={request.status} />
            </div>
            <p><span className="font-semibold">Request ID:</span> {request.id}</p>
            <p><span className="font-semibold">Subject:</span> {request.subject || 'Mathematics'}</p>
            <p><span className="font-semibold">Duration:</span> {request.duration || 'N/A'}</p>
            <p><span className="font-semibold">Tutor:</span> {request.tutorName || 'Not assigned yet'}</p>
            <p><span className="font-semibold">Description:</span> {request.description || 'No extra description provided.'}</p>

            <div>
              <p className="font-semibold">Attachments:</p>
              {request.attachments?.length ? (
                <ul className="mt-2 space-y-1">
                  {request.attachments.map((file, index) => (
                    <li key={`${file.fileName}-${index}`}>
                      <a href={file.downloadUrl} target="_blank" rel="noreferrer" className="text-brand underline">
                        {file.fileName || `Attachment ${index + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : request.attachment?.downloadUrl ? (
                <a href={request.attachment.downloadUrl} target="_blank" rel="noreferrer" className="text-brand underline">
                  {request.attachment.fileName || 'Open attachment'}
                </a>
              ) : (
                <p className="mt-1 text-zinc-500">No attachments uploaded.</p>
              )}
            </div>

            <div className="pt-2">
              <Link to="/app/student/requests" className="rounded-xl border border-zinc-300 px-3 py-2 font-semibold hover:bg-zinc-100">
                Back to My Requests
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Request not found.</p>
        )}
      </SectionCard>
    </div>
  );
}
